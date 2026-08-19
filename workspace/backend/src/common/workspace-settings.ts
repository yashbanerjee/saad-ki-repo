export const DEFAULT_NOTIFICATION_PREFS = {
  assignments: true,
  projects: true,
  comments: true,
  clientActivity: true,
  emailReceive: true,
  emailDigest: false,
  push: true,
};

export const DEFAULT_WORKSPACE_FLAGS = {
  clientPortalAccess: true,
  require2fa: false,
  auditLogging: true,
  sendNotificationEmails: true,
};

export type NotificationPrefs = typeof DEFAULT_NOTIFICATION_PREFS;
export type WorkspaceFlags = typeof DEFAULT_WORKSPACE_FLAGS;

export type SmtpSettings = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
};

export type FirebaseSettings = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
  apiKey: string;
  authDomain: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  vapidKey: string;
};

export type CompanySettings = {
  smtp: SmtpSettings;
  firebase: FirebaseSettings;
  workspace: WorkspaceFlags;
};

export type UserPreferences = {
  notifications: NotificationPrefs;
  compactSidebar: boolean;
  theme?: 'light' | 'dark';
  pushTokens: string[];
};

export function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function num(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function parseCompanySettings(raw: unknown): CompanySettings {
  const root = asRecord(raw);
  const smtpRaw = asRecord(root.smtp);
  const firebaseRaw = asRecord(root.firebase);
  const workspaceRaw = asRecord(root.workspace);

  return {
    smtp: {
      host: str(smtpRaw.host),
      port: num(smtpRaw.port, 587),
      secure: bool(smtpRaw.secure, false),
      user: str(smtpRaw.user),
      pass: str(smtpRaw.pass),
      from: str(smtpRaw.from),
    },
    firebase: {
      projectId: str(firebaseRaw.projectId),
      clientEmail: str(firebaseRaw.clientEmail),
      privateKey: str(firebaseRaw.privateKey),
      apiKey: str(firebaseRaw.apiKey),
      authDomain: str(firebaseRaw.authDomain),
      storageBucket: str(firebaseRaw.storageBucket),
      messagingSenderId: str(firebaseRaw.messagingSenderId),
      appId: str(firebaseRaw.appId),
      vapidKey: str(firebaseRaw.vapidKey),
    },
    workspace: {
      clientPortalAccess: bool(
        workspaceRaw.clientPortalAccess,
        DEFAULT_WORKSPACE_FLAGS.clientPortalAccess,
      ),
      require2fa: bool(workspaceRaw.require2fa, DEFAULT_WORKSPACE_FLAGS.require2fa),
      auditLogging: bool(workspaceRaw.auditLogging, DEFAULT_WORKSPACE_FLAGS.auditLogging),
      sendNotificationEmails: bool(
        workspaceRaw.sendNotificationEmails,
        DEFAULT_WORKSPACE_FLAGS.sendNotificationEmails,
      ),
    },
  };
}

export function parseUserPreferences(raw: unknown): UserPreferences {
  const root = asRecord(raw);
  const n = asRecord(root.notifications);
  const tokens = Array.isArray(root.pushTokens)
    ? root.pushTokens.filter((t): t is string => typeof t === 'string' && t.length > 20)
    : [];

  return {
    notifications: {
      assignments: bool(n.assignments, DEFAULT_NOTIFICATION_PREFS.assignments),
      projects: bool(n.projects, DEFAULT_NOTIFICATION_PREFS.projects),
      comments: bool(n.comments, DEFAULT_NOTIFICATION_PREFS.comments),
      clientActivity: bool(n.clientActivity, DEFAULT_NOTIFICATION_PREFS.clientActivity),
      emailReceive: bool(n.emailReceive, DEFAULT_NOTIFICATION_PREFS.emailReceive),
      emailDigest: bool(n.emailDigest, DEFAULT_NOTIFICATION_PREFS.emailDigest),
      push: bool(n.push, DEFAULT_NOTIFICATION_PREFS.push),
    },
    compactSidebar: bool(root.compactSidebar, false),
    theme: root.theme === 'dark' || root.theme === 'light' ? root.theme : undefined,
    pushTokens: [...new Set(tokens)],
  };
}

export function isSmtpReady(smtp: Pick<SmtpSettings, 'host' | 'from'>): boolean {
  return Boolean(smtp.host?.trim() && smtp.from?.trim());
}

export function isFirebaseAdminReady(
  firebase: Pick<FirebaseSettings, 'projectId' | 'clientEmail' | 'privateKey'>,
): boolean {
  return Boolean(
    firebase.projectId?.trim() &&
      firebase.clientEmail?.trim() &&
      firebase.privateKey?.trim(),
  );
}

export function isFirebaseWebReady(
  firebase: Pick<
    FirebaseSettings,
    'apiKey' | 'projectId' | 'appId' | 'messagingSenderId' | 'vapidKey'
  >,
): boolean {
  return Boolean(
    firebase.apiKey?.trim() &&
      firebase.projectId?.trim() &&
      firebase.appId?.trim() &&
      firebase.messagingSenderId?.trim() &&
      firebase.vapidKey?.trim(),
  );
}

export function serializeCompanySettings(settings: CompanySettings): object {
  return {
    smtp: settings.smtp,
    firebase: settings.firebase,
    workspace: settings.workspace,
  };
}

export function serializeUserPreferences(prefs: UserPreferences): object {
  return {
    notifications: prefs.notifications,
    compactSidebar: prefs.compactSidebar,
    ...(prefs.theme ? { theme: prefs.theme } : {}),
    pushTokens: prefs.pushTokens,
  };
}

export function parseServiceAccountJson(raw: string): Partial<FirebaseSettings> {
  const parsed = JSON.parse(extractJsonObject(raw)) as Record<string, unknown>;
  const privateKey = str(parsed.private_key || parsed.privateKey).replace(/\\n/g, '\n');
  return {
    projectId: str(parsed.project_id || parsed.projectId),
    clientEmail: str(parsed.client_email || parsed.clientEmail),
    privateKey,
  };
}

export function parseFirebaseWebJson(raw: string): Partial<FirebaseSettings> {
  const parsed = JSON.parse(extractJsonObject(raw)) as Record<string, unknown>;
  const nested = asRecord(parsed.firebase || parsed.config);
  const src = Object.keys(nested).length ? nested : parsed;
  return {
    apiKey: str(src.apiKey),
    authDomain: str(src.authDomain),
    projectId: str(src.projectId || src.project_id),
    storageBucket: str(src.storageBucket),
    messagingSenderId: str(src.messagingSenderId),
    appId: str(src.appId),
    vapidKey: str(src.vapidKey || src.vapid_key),
  };
}

function extractJsonObject(raw: string): string {
  const trimmed = raw.trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}
