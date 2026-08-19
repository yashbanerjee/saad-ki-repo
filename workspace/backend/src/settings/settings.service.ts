import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { PushService } from '../push/push.service';
import { AuthenticatedUser } from '../common/decorators';
import {
  isFirebaseAdminReady,
  isFirebaseWebReady,
  isSmtpReady,
  parseCompanySettings,
  parseFirebaseWebJson,
  parseServiceAccountJson,
  parseUserPreferences,
  serializeCompanySettings,
  serializeUserPreferences,
  type FirebaseSettings,
  type SmtpSettings,
} from '../common/workspace-settings';
import {
  FirebaseSettingsDto,
  SmtpSettingsDto,
  UpdatePasswordDto,
  UpdatePreferencesDto,
  UpdateProfileDto,
  UpdateWorkspaceDto,
} from './dto/settings.dto';

@Injectable()
export class SettingsService {
  constructor(
    private prisma: PrismaService,
    private mail: MailService,
    private push: PushService,
  ) {}

  canManageMail(user: AuthenticatedUser) {
    return (user.roles ?? []).some((role) =>
      ['super_admin', 'company_admin', 'project_manager', 'team_lead'].includes(role),
    );
  }

  canManageWorkspace(user: AuthenticatedUser) {
    return (
      (user.permissions ?? []).includes('company:manage') ||
      (user.roles ?? []).some((role) => ['super_admin', 'company_admin'].includes(role))
    );
  }

  async get(user: AuthenticatedUser) {
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: { company: { select: { id: true, name: true, settings: true } } },
    });
    if (!dbUser) throw new UnauthorizedException();

    const prefs = parseUserPreferences(dbUser.preferences);
    const companySettings = parseCompanySettings(dbUser.company?.settings);
    const manageMail = this.canManageMail(user);
    const manageWorkspace = this.canManageWorkspace(user);

    return {
      profile: {
        firstName: dbUser.firstName,
        lastName: dbUser.lastName,
        name: `${dbUser.firstName} ${dbUser.lastName}`.trim(),
        email: dbUser.email,
        companyName: dbUser.company?.name ?? null,
      },
      preferences: {
        notifications: prefs.notifications,
        compactSidebar: prefs.compactSidebar,
        theme: prefs.theme ?? null,
        pushRegistered: prefs.pushTokens.length > 0,
      },
      capabilities: {
        canManageMail: manageMail,
        canManageWorkspace: manageWorkspace,
      },
      workspace: manageWorkspace
        ? companySettings.workspace
        : manageMail
          ? { sendNotificationEmails: companySettings.workspace.sendNotificationEmails }
          : null,
      smtp: manageMail
        ? {
            configured: isSmtpReady(companySettings.smtp) || this.mail.hasEnvSmtp(),
            usingWorkspace: isSmtpReady(companySettings.smtp),
            host: companySettings.smtp.host || null,
            port: companySettings.smtp.port,
            secure: companySettings.smtp.secure,
            user: companySettings.smtp.user || null,
            from: companySettings.smtp.from || null,
            hasPass: Boolean(companySettings.smtp.pass),
          }
        : null,
      firebase: manageMail
        ? {
            configured: isFirebaseAdminReady(companySettings.firebase),
            webConfigured: isFirebaseWebReady(companySettings.firebase),
            projectId: companySettings.firebase.projectId || null,
            clientEmail: companySettings.firebase.clientEmail || null,
            hasPrivateKey: Boolean(companySettings.firebase.privateKey),
            apiKey: companySettings.firebase.apiKey || null,
            authDomain: companySettings.firebase.authDomain || null,
            storageBucket: companySettings.firebase.storageBucket || null,
            messagingSenderId: companySettings.firebase.messagingSenderId || null,
            appId: companySettings.firebase.appId || null,
            vapidKey: companySettings.firebase.vapidKey || null,
          }
        : null,
      firebaseWeb: isFirebaseWebReady(companySettings.firebase)
        ? {
            apiKey: companySettings.firebase.apiKey,
            authDomain: companySettings.firebase.authDomain,
            projectId: companySettings.firebase.projectId,
            storageBucket: companySettings.firebase.storageBucket,
            messagingSenderId: companySettings.firebase.messagingSenderId,
            appId: companySettings.firebase.appId,
            vapidKey: companySettings.firebase.vapidKey,
          }
        : null,
    };
  }

  async updateProfile(user: AuthenticatedUser, dto: UpdateProfileDto) {
    let firstName = dto.firstName?.trim();
    let lastName = dto.lastName?.trim();
    if (dto.name?.trim()) {
      const parts = dto.name.trim().split(/\s+/);
      firstName = parts[0];
      lastName = parts.slice(1).join(' ') || firstName;
    }
    if (!firstName) throw new BadRequestException('First name is required');

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        firstName,
        lastName: lastName || firstName,
      },
      select: { firstName: true, lastName: true, email: true },
    });
    return {
      firstName: updated.firstName,
      lastName: updated.lastName,
      name: `${updated.firstName} ${updated.lastName}`.trim(),
      email: updated.email,
    };
  }

  async updatePreferences(user: AuthenticatedUser, dto: UpdatePreferencesDto) {
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { preferences: true },
    });
    if (!dbUser) throw new UnauthorizedException();
    const current = parseUserPreferences(dbUser.preferences);
    const next = {
      ...current,
      compactSidebar:
        dto.compactSidebar !== undefined ? dto.compactSidebar : current.compactSidebar,
      theme: dto.theme ?? current.theme,
      notifications: {
        ...current.notifications,
        ...(dto.notifications ?? {}),
      },
    };
    await this.prisma.user.update({
      where: { id: user.id },
      data: { preferences: serializeUserPreferences(next) as object },
    });
    return {
      notifications: next.notifications,
      compactSidebar: next.compactSidebar,
      theme: next.theme ?? null,
      pushRegistered: next.pushTokens.length > 0,
    };
  }

  async updatePassword(user: AuthenticatedUser, dto: UpdatePasswordDto) {
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true },
    });
    if (!dbUser) throw new UnauthorizedException();
    const ok = await bcrypt.compare(dto.currentPassword, dbUser.passwordHash);
    if (!ok) throw new BadRequestException('Current password is incorrect');
    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });
    return { message: 'Password updated' };
  }

  async updateWorkspace(user: AuthenticatedUser, dto: UpdateWorkspaceDto) {
    this.assertCompany(user);
    const company = await this.prisma.company.findUnique({
      where: { id: user.companyId! },
      select: { settings: true },
    });
    if (!company) throw new BadRequestException('Company not found');
    const current = parseCompanySettings(company.settings);

    if (dto.smtp) {
      if (!this.canManageMail(user)) {
        throw new ForbiddenException('You cannot update SMTP settings');
      }
      current.smtp = this.mergeSmtp(current.smtp, dto.smtp);
    }
    if (dto.firebase) {
      if (!this.canManageMail(user)) {
        throw new ForbiddenException('You cannot update Firebase settings');
      }
      current.firebase = this.mergeFirebase(current.firebase, dto.firebase);
    }
    if (dto.workspace) {
      if (this.canManageWorkspace(user)) {
        current.workspace = { ...current.workspace, ...dto.workspace };
      } else if (
        this.canManageMail(user) &&
        dto.workspace.sendNotificationEmails !== undefined
      ) {
        current.workspace.sendNotificationEmails = dto.workspace.sendNotificationEmails;
      } else {
        throw new ForbiddenException('You cannot update workspace settings');
      }
    }

    await this.prisma.company.update({
      where: { id: user.companyId! },
      data: { settings: serializeCompanySettings(current) as object },
    });
    this.mail.invalidateCompany(user.companyId!);
    return this.get(user);
  }

  async testSmtp(user: AuthenticatedUser, to?: string) {
    this.assertCompany(user);
    if (!this.canManageMail(user)) {
      throw new ForbiddenException('You cannot test SMTP');
    }
    const recipient = to || user.email;
    await this.mail.sendTestEmail(user.companyId!, recipient);
    return { message: `Test email sent to ${recipient}` };
  }

  async testPush(user: AuthenticatedUser) {
    this.assertCompany(user);
    if (!this.canManageMail(user)) {
      throw new ForbiddenException('You cannot test push notifications');
    }
    const result = await this.push.sendToUser(
      user.companyId!,
      user.id,
      'TaskFlow push test',
      'Firebase is connected and this device can receive alerts.',
      { type: 'SYSTEM' },
    );
    if (!result.sent) {
      throw new BadRequestException(
        result.reason === 'firebase_not_configured'
          ? 'Add a Firebase service account first'
          : 'Enable push on this device first, then try again',
      );
    }
    return { message: 'Test push sent', sent: result.sent };
  }

  async registerPushToken(user: AuthenticatedUser, token: string) {
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { preferences: true },
    });
    if (!dbUser) throw new UnauthorizedException();
    const prefs = parseUserPreferences(dbUser.preferences);
    const pushTokens = [...new Set([...prefs.pushTokens, token])].slice(-20);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        preferences: serializeUserPreferences({ ...prefs, pushTokens }) as object,
      },
    });
    return { registered: true, count: pushTokens.length };
  }

  async unregisterPushToken(user: AuthenticatedUser, token?: string) {
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { preferences: true },
    });
    if (!dbUser) throw new UnauthorizedException();
    const prefs = parseUserPreferences(dbUser.preferences);
    const pushTokens = token
      ? prefs.pushTokens.filter((t) => t !== token)
      : [];
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        preferences: serializeUserPreferences({ ...prefs, pushTokens }) as object,
      },
    });
    return { registered: false, count: pushTokens.length };
  }

  private mergeSmtp(current: SmtpSettings, dto: SmtpSettingsDto): SmtpSettings {
    if (dto.clear) {
      return { host: '', port: 587, secure: false, user: '', pass: '', from: '' };
    }
    const next = {
      host: dto.host !== undefined ? dto.host.trim() : current.host,
      port: dto.port ?? current.port,
      secure: dto.secure ?? current.secure,
      user: dto.user !== undefined ? dto.user.trim() : current.user,
      pass: dto.pass && dto.pass.trim() ? dto.pass : current.pass,
      from: dto.from !== undefined ? dto.from.trim() : current.from,
    };
    if (!next.from && next.user) next.from = next.user;
    if (next.port === 465) next.secure = true;
    return next;
  }

  private mergeFirebase(
    current: FirebaseSettings,
    dto: FirebaseSettingsDto,
  ): FirebaseSettings {
    if (dto.clear) {
      return {
        projectId: '',
        clientEmail: '',
        privateKey: '',
        apiKey: '',
        authDomain: '',
        storageBucket: '',
        messagingSenderId: '',
        appId: '',
        vapidKey: '',
      };
    }

    const next = { ...current };
    if (dto.serviceAccountJson?.trim()) {
      try {
        const parsed = parseServiceAccountJson(dto.serviceAccountJson);
        Object.assign(next, parsed);
      } catch {
        throw new BadRequestException('Service account JSON is invalid');
      }
    }
    if (dto.webConfigJson?.trim()) {
      try {
        const parsed = parseFirebaseWebJson(dto.webConfigJson);
        Object.assign(next, parsed);
      } catch {
        throw new BadRequestException('Firebase web config JSON is invalid');
      }
    }

    if (dto.projectId !== undefined) next.projectId = dto.projectId.trim();
    if (dto.clientEmail !== undefined) next.clientEmail = dto.clientEmail.trim();
    if (dto.privateKey?.trim()) next.privateKey = dto.privateKey.replace(/\\n/g, '\n');
    if (dto.apiKey !== undefined) next.apiKey = dto.apiKey.trim();
    if (dto.authDomain !== undefined) next.authDomain = dto.authDomain.trim();
    if (dto.storageBucket !== undefined) next.storageBucket = dto.storageBucket.trim();
    if (dto.messagingSenderId !== undefined) {
      next.messagingSenderId = dto.messagingSenderId.trim();
    }
    if (dto.appId !== undefined) next.appId = dto.appId.trim();
    if (dto.vapidKey !== undefined) next.vapidKey = dto.vapidKey.trim();
    return next;
  }

  private assertCompany(user: AuthenticatedUser) {
    if (!user.companyId) throw new BadRequestException('No workspace on this account');
  }
}
