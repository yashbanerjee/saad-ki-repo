import { Injectable, Logger } from '@nestjs/common';
import { createSign } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  isFirebaseAdminReady,
  parseCompanySettings,
  parseUserPreferences,
  serializeUserPreferences,
  type FirebaseSettings,
} from '../common/workspace-settings';

type AccessToken = { token: string; exp: number };

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly tokenCache = new Map<string, AccessToken>();

  constructor(private prisma: PrismaService) {}

  async getFirebase(companyId?: string | null): Promise<FirebaseSettings | null> {
    if (!companyId) return null;
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { settings: true },
    });
    if (!company) return null;
    const firebase = parseCompanySettings(company.settings).firebase;
    return isFirebaseAdminReady(firebase) ? firebase : null;
  }

  async sendToUser(
    companyId: string,
    userId: string,
    title: string,
    body?: string,
    data?: Record<string, unknown>,
  ) {
    const firebase = await this.getFirebase(companyId);
    if (!firebase) return { sent: 0, reason: 'firebase_not_configured' };

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    });
    if (!user) return { sent: 0, reason: 'user_not_found' };

    const prefs = parseUserPreferences(user.preferences);
    if (!prefs.notifications.push || !prefs.pushTokens.length) {
      return { sent: 0, reason: 'no_tokens' };
    }

    const payload: Record<string, string> = {};
    for (const [key, value] of Object.entries(data ?? {})) {
      if (value == null) continue;
      payload[key] = typeof value === 'string' ? value : JSON.stringify(value);
    }

    let sent = 0;
    const remaining: string[] = [];
    for (const token of prefs.pushTokens) {
      const result = await this.sendToToken(firebase, token, title, body, payload);
      if (result === 'invalid') continue;
      remaining.push(token);
      if (result === 'ok') sent += 1;
    }

    if (remaining.length !== prefs.pushTokens.length) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          preferences: serializeUserPreferences({ ...prefs, pushTokens: remaining }) as object,
        },
      });
    }

    return { sent };
  }

  async sendToToken(
    firebase: FirebaseSettings,
    deviceToken: string,
    title: string,
    body?: string,
    data?: Record<string, string>,
  ): Promise<'ok' | 'invalid' | 'error'> {
    try {
      const accessToken = await this.getAccessToken(firebase);
      const res = await fetch(
        `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(firebase.projectId)}/messages:send`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              token: deviceToken,
              notification: {
                title,
                body: body || undefined,
              },
              data: data && Object.keys(data).length ? data : undefined,
              webpush: {
                notification: {
                  title,
                  body: body || undefined,
                },
                fcm_options: data?.link ? { link: data.link } : undefined,
              },
            },
          }),
        },
      );

      if (res.ok) return 'ok';

      const errText = await res.text();
      if (
        res.status === 404 ||
        /UNREGISTERED|NOT_FOUND|INVALID_ARGUMENT/i.test(errText)
      ) {
        this.logger.warn(`Dropping invalid FCM token for project ${firebase.projectId}`);
        return 'invalid';
      }
      this.logger.error(`FCM send failed (${res.status}): ${errText}`);
      return 'error';
    } catch (error) {
      this.logger.error('FCM send threw', error);
      return 'error';
    }
  }

  private async getAccessToken(firebase: FirebaseSettings): Promise<string> {
    const cached = this.tokenCache.get(firebase.clientEmail);
    const now = Math.floor(Date.now() / 1000);
    if (cached && cached.exp - 60 > now) return cached.token;

    const jwt = this.signServiceAccountJwt(firebase);
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });
    const json = (await res.json()) as { access_token?: string; expires_in?: number; error?: string };
    if (!res.ok || !json.access_token) {
      throw new Error(json.error || 'Failed to mint Google access token for FCM');
    }
    const exp = now + (json.expires_in ?? 3600);
    this.tokenCache.set(firebase.clientEmail, { token: json.access_token, exp });
    return json.access_token;
  }

  private signServiceAccountJwt(firebase: FirebaseSettings): string {
    const now = Math.floor(Date.now() / 1000);
    const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const payload = base64Url(
      JSON.stringify({
        iss: firebase.clientEmail,
        scope: 'https://www.googleapis.com/auth/firebase.messaging',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
      }),
    );
    const unsigned = `${header}.${payload}`;
    const sign = createSign('RSA-SHA256');
    sign.update(unsigned);
    sign.end();
    const key = firebase.privateKey.replace(/\\n/g, '\n');
    const signature = sign
      .sign(key, 'base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
    return `${unsigned}.${signature}`;
  }
}

function base64Url(value: string): string {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}
