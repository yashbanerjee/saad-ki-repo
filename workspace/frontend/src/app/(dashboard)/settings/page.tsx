"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import {
  User,
  Bell,
  Shield,
  Palette,
  Mail,
  Plug,
  Building2,
  CheckCircle2,
  CircleDashed,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { hasRole, isClientUser, useAuthStore } from "@/lib/auth-store";
import { useSidebarStore } from "@/lib/sidebar-store";
import { settingsApi } from "@/lib/api";
import { toast } from "sonner";

type NotifPrefs = {
  assignments: boolean;
  projects: boolean;
  comments: boolean;
  clientActivity: boolean;
  emailReceive: boolean;
  emailDigest: boolean;
  push: boolean;
};

const DEFAULT_PREFS: NotifPrefs = {
  assignments: true,
  projects: true,
  comments: true,
  clientActivity: true,
  emailReceive: true,
  emailDigest: false,
  push: true,
};

type SettingsPayload = {
  profile?: { firstName?: string; lastName?: string; name?: string; email?: string; companyName?: string };
  preferences?: {
    notifications?: Partial<NotifPrefs>;
    compactSidebar?: boolean;
    theme?: "light" | "dark" | null;
    pushRegistered?: boolean;
  };
  capabilities?: { canManageMail?: boolean; canManageWorkspace?: boolean };
  branding?: { name?: string | null; logo?: string | null; favicon?: string | null };
  organization?: {
    name?: string;
    email?: string;
    phone?: string;
    website?: string;
    logo?: string | null;
    favicon?: string | null;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
    registrationNo?: string;
    gstNumber?: string;
    panNumber?: string;
  } | null;
  workspace?: {
    clientPortalAccess?: boolean;
    require2fa?: boolean;
    auditLogging?: boolean;
    sendNotificationEmails?: boolean;
  } | null;
  smtp?: {
    configured?: boolean;
    usingWorkspace?: boolean;
    host?: string | null;
    port?: number;
    secure?: boolean;
    user?: string | null;
    from?: string | null;
    hasPass?: boolean;
  } | null;
  firebase?: {
    configured?: boolean;
    webConfigured?: boolean;
    projectId?: string | null;
    clientEmail?: string | null;
    hasPrivateKey?: boolean;
    apiKey?: string | null;
    authDomain?: string | null;
    storageBucket?: string | null;
    messagingSenderId?: string | null;
    appId?: string | null;
    vapidKey?: string | null;
  } | null;
};

const EMPTY_ORG = {
  name: "",
  email: "",
  phone: "",
  website: "",
  address: "",
  city: "",
  state: "",
  country: "",
  postalCode: "",
  registrationNo: "",
  gstNumber: "",
  panNumber: "",
};

function unwrap<T>(res: { data?: unknown }): T {
  const body = res.data as { data?: unknown } | undefined;
  return (body && typeof body === "object" && "data" in body && body.data
    ? body.data
    : res.data) as T;
}

function errorMessage(err: unknown, fallback: string) {
  const message = (err as { response?: { data?: { message?: string | string[] } } })?.response
    ?.data?.message;
  if (Array.isArray(message)) return message.join(", ");
  return message || fallback;
}

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const collapsed = useSidebarStore((s) => s.collapsed);
  const setCollapsed = useSidebarStore((s) => s.setCollapsed);
  const isClient = isClientUser(user);
  const isAdmin = hasRole(user, ["admin"]);
  const canManageMail = hasRole(user, ["admin", "manager"]);
  const tabFromUrl = searchParams.get("tab") || "profile";
  const [tab, setTab] = useState(tabFromUrl);

  const [name, setName] = useState(user?.name || "");
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [smtp, setSmtp] = useState({
    host: "",
    port: "587",
    user: "",
    pass: "",
    from: "",
    secure: false,
  });
  const [firebaseJson, setFirebaseJson] = useState("");
  const [webJson, setWebJson] = useState("");
  const [vapidKey, setVapidKey] = useState("");
  const [workspace, setWorkspace] = useState({
    clientPortalAccess: true,
    require2fa: false,
    auditLogging: true,
    sendNotificationEmails: true,
  });
  const [org, setOrg] = useState(EMPTY_ORG);

  useEffect(() => {
    const next = searchParams.get("tab");
    if (next) setTab(next);
  }, [searchParams]);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => unwrap<SettingsPayload>(await settingsApi.get()),
  });
  const canManageWorkspace = Boolean(settings?.capabilities?.canManageWorkspace || isAdmin);

  useEffect(() => {
    if (!settings) return;
    if (settings.profile?.name) setName(settings.profile.name);
    setPrefs({ ...DEFAULT_PREFS, ...(settings.preferences?.notifications ?? {}) });
    if (settings.smtp) {
      setSmtp((prev) => ({
        ...prev,
        host: settings.smtp?.host || "",
        port: String(settings.smtp?.port || 587),
        user: settings.smtp?.user || "",
        from: settings.smtp?.from || "",
        secure: Boolean(settings.smtp?.secure),
        pass: "",
      }));
    }
    if (settings.firebase) {
      setVapidKey(settings.firebase.vapidKey || "");
    }
    if (settings.workspace) {
      setWorkspace({
        clientPortalAccess: settings.workspace.clientPortalAccess ?? true,
        require2fa: settings.workspace.require2fa ?? false,
        auditLogging: settings.workspace.auditLogging ?? true,
        sendNotificationEmails: settings.workspace.sendNotificationEmails ?? true,
      });
    }
    if (settings.organization) {
      setOrg({
        ...EMPTY_ORG,
        name: settings.organization.name || "",
        email: settings.organization.email || "",
        phone: settings.organization.phone || "",
        website: settings.organization.website || "",
        address: settings.organization.address || "",
        city: settings.organization.city || "",
        state: settings.organization.state || "",
        country: settings.organization.country || "",
        postalCode: settings.organization.postalCode || "",
        registrationNo: settings.organization.registrationNo || "",
        gstNumber: settings.organization.gstNumber || "",
        panNumber: settings.organization.panNumber || "",
      });
    }
  }, [settings]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["settings"] });

  const profileMutation = useMutation({
    mutationFn: () => settingsApi.updateProfile({ name }),
    onSuccess: (res) => {
      const payload = unwrap<{ name?: string }>(res);
      if (payload?.name) updateUser({ name: payload.name });
      toast.success("Profile saved");
      invalidate();
    },
    onError: (err) => toast.error(errorMessage(err, "Could not save profile")),
  });

  const prefsMutation = useMutation({
    mutationFn: (next: {
      notifications?: Partial<NotifPrefs>;
      compactSidebar?: boolean;
      theme?: "light" | "dark";
    }) => settingsApi.updatePreferences(next),
    onSuccess: () => invalidate(),
    onError: (err) => toast.error(errorMessage(err, "Could not save preferences")),
  });

  const passwordMutation = useMutation({
    mutationFn: () =>
      settingsApi.updatePassword({ currentPassword, newPassword }),
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated");
    },
    onError: (err) => toast.error(errorMessage(err, "Could not update password")),
  });

  const smtpMutation = useMutation({
    mutationFn: () =>
      settingsApi.updateWorkspace({
        smtp: {
          host: smtp.host,
          port: Number(smtp.port) || 587,
          user: smtp.user,
          pass: smtp.pass || undefined,
          from: smtp.from,
          secure: smtp.secure,
        },
      }),
    onSuccess: () => {
      setSmtp((s) => ({ ...s, pass: "" }));
      toast.success("SMTP saved — new mail will use these settings");
      invalidate();
    },
    onError: (err) => toast.error(errorMessage(err, "Could not save SMTP")),
  });

  const firebaseMutation = useMutation({
    mutationFn: () =>
      settingsApi.updateWorkspace({
        firebase: {
          serviceAccountJson: firebaseJson.trim() || undefined,
          webConfigJson: webJson.trim() || undefined,
          vapidKey: vapidKey.trim() || undefined,
        },
      }),
    onSuccess: () => {
      setFirebaseJson("");
      setWebJson("");
      toast.success("Firebase saved — push can be sent on this workspace");
      invalidate();
    },
    onError: (err) => toast.error(errorMessage(err, "Could not save Firebase")),
  });

  const workspaceMutation = useMutation({
    mutationFn: (next: typeof workspace) => settingsApi.updateWorkspace({ workspace: next }),
    onSuccess: () => {
      toast.success("Workspace settings saved");
      invalidate();
    },
    onError: (err) => toast.error(errorMessage(err, "Could not save workspace settings")),
  });

  const orgMutation = useMutation({
    mutationFn: () => settingsApi.updateOrganization(org),
    onSuccess: (res) => {
      const payload = unwrap<{ name?: string; logo?: string | null; favicon?: string | null }>(res);
      updateUser({
        companyName: payload?.name || org.name,
        ...(payload?.logo ? { companyLogo: payload.logo } : {}),
        ...(payload?.favicon ? { companyFavicon: payload.favicon } : {}),
      });
      toast.success("Organization details saved");
      invalidate();
    },
    onError: (err) => toast.error(errorMessage(err, "Could not save organization")),
  });

  const uploadBrand = async (kind: "logo" | "favicon", file: File) => {
    try {
      const res =
        kind === "logo"
          ? await settingsApi.uploadOrganizationLogo(file)
          : await settingsApi.uploadOrganizationFavicon(file);
      const payload = unwrap<{ name?: string; logo?: string | null; favicon?: string | null }>(res);
      updateUser({
        ...(payload?.logo ? { companyLogo: payload.logo } : {}),
        ...(payload?.favicon ? { companyFavicon: payload.favicon } : {}),
      });
      toast.success(kind === "logo" ? "Logo updated" : "Favicon updated");
      invalidate();
    } catch (err) {
      toast.error(errorMessage(err, `Could not upload ${kind}`));
    }
  };

  const savePrefs = (next: NotifPrefs) => {
    setPrefs(next);
    prefsMutation.mutate({ notifications: next });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Account, notifications, theme, and workspace mail for your role
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="profile">
            <User className="h-4 w-4 mr-1" /> Profile
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="h-4 w-4 mr-1" /> Notifications
          </TabsTrigger>
          <TabsTrigger value="appearance">
            <Palette className="h-4 w-4 mr-1" /> Appearance
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="h-4 w-4 mr-1" /> Security
          </TabsTrigger>
          {canManageMail && (
            <TabsTrigger value="email">
              <Mail className="h-4 w-4 mr-1" /> Email & SMTP
            </TabsTrigger>
          )}
          {canManageMail && (
            <TabsTrigger value="integrations">
              <Plug className="h-4 w-4 mr-1" /> Integrations
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="workspace">
              <Building2 className="h-4 w-4 mr-1" /> Workspace
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="profile" className="mt-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Your account details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                <Skeleton className="h-24" />
              ) : (
                <>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Full name</Label>
                      <Input value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input value={settings?.profile?.email || user?.email || ""} type="email" disabled />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground capitalize">Role: {user?.role}</p>
                  <Button
                    onClick={() => profileMutation.mutate()}
                    disabled={profileMutation.isPending || !name.trim()}
                  >
                    {profileMutation.isPending ? "Saving…" : "Save changes"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {canManageWorkspace && (
            <OrganizationCard
              org={org}
              setOrg={setOrg}
              logo={settings?.organization?.logo || settings?.branding?.logo}
              favicon={settings?.organization?.favicon || settings?.branding?.favicon}
              loading={isLoading}
              saving={orgMutation.isPending}
              onSave={() => {
                if (!org.name.trim() || !org.email.trim()) {
                  toast.error("Organization name and email are required");
                  return;
                }
                orgMutation.mutate();
              }}
              onUpload={uploadBrand}
            />
          )}
        </TabsContent>

        <TabsContent value="notifications" className="mt-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Push & in-app</CardTitle>
              <CardDescription>What you see in the bell and on this device</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { key: "push" as const, label: "Push notifications", desc: "Browser alerts when you are away" },
                { key: "assignments" as const, label: "Issue assignments", desc: "When tasks you work on are created, edited, or deleted" },
                { key: "projects" as const, label: "Project updates", desc: "Milestones, status changes, and board activity" },
                { key: "comments" as const, label: "Comments & mentions", desc: "When someone comments on work you follow" },
                ...(!isClient
                  ? [
                      {
                        key: "clientActivity" as const,
                        label: "Client activity",
                        desc: "When a client adds, edits, or deletes tasks, comments, or documents",
                      },
                    ]
                  : []),
              ].map((pref) => (
                <div key={pref.key} className="flex items-center justify-between gap-4">
                  <div>
                    <Label>{pref.label}</Label>
                    <p className="text-xs text-muted-foreground">{pref.desc}</p>
                  </div>
                  <Switch
                    checked={prefs[pref.key]}
                    onCheckedChange={(checked) => savePrefs({ ...prefs, [pref.key]: checked })}
                  />
                </div>
              ))}
              {settings?.preferences?.pushRegistered ? (
                <p className="text-xs text-muted-foreground">This browser is registered for push.</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Allow notifications in the browser after Firebase is configured for this workspace.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Email</CardTitle>
              <CardDescription>Mail you receive from TaskFlow</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label>Receive notification emails</Label>
                  <p className="text-xs text-muted-foreground">
                    Assignments, mentions, and important project mail
                  </p>
                </div>
                <Switch
                  checked={prefs.emailReceive}
                  onCheckedChange={(checked) => savePrefs({ ...prefs, emailReceive: checked })}
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label>Daily digest</Label>
                  <p className="text-xs text-muted-foreground">One summary email each morning</p>
                </div>
                <Switch
                  checked={prefs.emailDigest}
                  onCheckedChange={(checked) => savePrefs({ ...prefs, emailDigest: checked })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>Theme and layout for this browser</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label>Theme</Label>
                  <p className="text-xs text-muted-foreground">Light or dark across the app</p>
                </div>
                <div className="flex gap-2">
                  {(["light", "dark"] as const).map((t) => (
                    <Button
                      key={t}
                      variant={(theme ?? "light") === t ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setTheme(t);
                        prefsMutation.mutate({ theme: t });
                      }}
                      className="capitalize"
                    >
                      {t}
                    </Button>
                  ))}
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label>Compact sidebar</Label>
                  <p className="text-xs text-muted-foreground">Collapse the left nav by default</p>
                </div>
                <Switch
                  checked={collapsed}
                  onCheckedChange={(checked) => {
                    setCollapsed(checked);
                    prefsMutation.mutate({ compactSidebar: checked });
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Security</CardTitle>
              <CardDescription>Password for your login</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Current password</Label>
                <Input
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>New password</Label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Confirm new password</Label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <Button
                onClick={() => {
                  if (newPassword.length < 8) {
                    toast.error("New password must be at least 8 characters");
                    return;
                  }
                  if (newPassword !== confirmPassword) {
                    toast.error("New passwords do not match");
                    return;
                  }
                  passwordMutation.mutate();
                }}
                disabled={passwordMutation.isPending || !currentPassword || !newPassword}
              >
                {passwordMutation.isPending ? "Updating…" : "Update password"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {canManageMail && (
          <TabsContent value="email" className="mt-6 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>SMTP outbound mail</CardTitle>
                <CardDescription>
                  Invites, invoices, and notification emails use this server once saved.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label>Status</Label>
                    <p className="text-xs text-muted-foreground">
                      {settings?.smtp?.usingWorkspace
                        ? "Using workspace SMTP"
                        : settings?.smtp?.configured
                          ? "Using server environment SMTP"
                          : "Not configured"}
                    </p>
                  </div>
                  <Badge variant={settings?.smtp?.configured ? "success" : "secondary"} className="gap-1">
                    {settings?.smtp?.configured ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <CircleDashed className="h-3 w-3" />
                    )}
                    {settings?.smtp?.configured ? "Connected" : "Not configured"}
                  </Badge>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Host</Label>
                    <Input
                      value={smtp.host}
                      onChange={(e) => setSmtp((s) => ({ ...s, host: e.target.value }))}
                      placeholder="smtp.gmail.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Port</Label>
                    <Input
                      value={smtp.port}
                      onChange={(e) => setSmtp((s) => ({ ...s, port: e.target.value }))}
                      placeholder="587"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Username</Label>
                    <Input
                      value={smtp.user}
                      onChange={(e) => setSmtp((s) => ({ ...s, user: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Password</Label>
                    <Input
                      type="password"
                      value={smtp.pass}
                      onChange={(e) => setSmtp((s) => ({ ...s, pass: e.target.value }))}
                      placeholder={settings?.smtp?.hasPass ? "Leave blank to keep saved password" : ""}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>From address</Label>
                    <Input
                      value={smtp.from}
                      onChange={(e) => setSmtp((s) => ({ ...s, from: e.target.value }))}
                      placeholder="TaskFlow <noreply@yourcompany.com>"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label>Use TLS (port 465)</Label>
                    <p className="text-xs text-muted-foreground">Turn on for implicit SSL</p>
                  </div>
                  <Switch
                    checked={smtp.secure}
                    onCheckedChange={(checked) => setSmtp((s) => ({ ...s, secure: checked }))}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => smtpMutation.mutate()} disabled={smtpMutation.isPending}>
                    {smtpMutation.isPending ? "Saving…" : "Save SMTP"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      try {
                        await settingsApi.testSmtp(user?.email);
                        toast.success(`Test email sent to ${user?.email}`);
                      } catch (err) {
                        toast.error(errorMessage(err, "SMTP test failed"));
                      }
                    }}
                  >
                    Send test email
                  </Button>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Mail receive</CardTitle>
                <CardDescription>
                  Control whether this workspace sends notification mail to members and clients
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label>Send notification emails</Label>
                    <p className="text-xs text-muted-foreground">
                      Members still choose their own digest in Notifications
                    </p>
                  </div>
                  <Switch
                    checked={workspace.sendNotificationEmails}
                    onCheckedChange={(checked) => {
                      const next = { ...workspace, sendNotificationEmails: checked };
                      setWorkspace(next);
                      workspaceMutation.mutate(next);
                    }}
                    disabled={workspaceMutation.isPending}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {canManageMail && (
          <TabsContent value="integrations" className="mt-6 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Firebase push</CardTitle>
                <CardDescription>
                  Paste a service account JSON and web config. Members who allow notifications will get push alerts.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label>Status</Label>
                    <p className="text-xs text-muted-foreground">
                      {settings?.firebase?.configured
                        ? "Admin SDK connected"
                        : "Add a service account to send push"}
                      {settings?.firebase?.webConfigured ? " · Web config ready" : " · Web config still needed"}
                    </p>
                  </div>
                  <Badge variant={settings?.firebase?.configured ? "success" : "secondary"} className="gap-1">
                    {settings?.firebase?.configured ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <CircleDashed className="h-3 w-3" />
                    )}
                    {settings?.firebase?.configured ? "Connected" : "Not configured"}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <Label>Service account JSON</Label>
                  <Textarea
                    className="min-h-28 font-mono text-xs"
                    value={firebaseJson}
                    onChange={(e) => setFirebaseJson(e.target.value)}
                    placeholder={
                      settings?.firebase?.hasPrivateKey
                        ? "Leave blank to keep the saved key, or paste a new JSON"
                        : '{ "type": "service_account", "project_id": "...", "private_key": "...", "client_email": "..." }'
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Web app config JSON</Label>
                  <Textarea
                    className="min-h-24 font-mono text-xs"
                    value={webJson}
                    onChange={(e) => setWebJson(e.target.value)}
                    placeholder='{ "apiKey": "...", "authDomain": "...", "projectId": "...", "messagingSenderId": "...", "appId": "..." }'
                  />
                </div>
                <div className="space-y-2">
                  <Label>Web Push VAPID key</Label>
                  <Input
                    value={vapidKey}
                    onChange={(e) => setVapidKey(e.target.value)}
                    placeholder="From Firebase Cloud Messaging → Web Push certificates"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => firebaseMutation.mutate()} disabled={firebaseMutation.isPending}>
                    {firebaseMutation.isPending ? "Saving…" : "Save Firebase"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      try {
                        await settingsApi.testPush();
                        toast.success("Test push sent to this browser");
                      } catch (err) {
                        toast.error(errorMessage(err, "Push test failed"));
                      }
                    }}
                  >
                    Send test push
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="workspace" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Workspace</CardTitle>
                <CardDescription>Admin controls for this company</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {(
                  [
                    {
                      key: "clientPortalAccess" as const,
                      label: "Client portal access",
                      desc: "Allow linked clients to use their project portal",
                    },
                    {
                      key: "require2fa" as const,
                      label: "Require 2FA for staff",
                      desc: "Ask admins and managers for two-factor on next login",
                    },
                    {
                      key: "auditLogging" as const,
                      label: "Audit logging",
                      desc: "Record administrative actions in the audit log",
                    },
                  ] as const
                ).map((setting) => (
                  <div key={setting.key} className="flex items-center justify-between gap-4">
                    <div>
                      <Label>{setting.label}</Label>
                      <p className="text-xs text-muted-foreground">{setting.desc}</p>
                    </div>
                    <Switch
                      checked={workspace[setting.key]}
                      onCheckedChange={(checked) => {
                        const next = { ...workspace, [setting.key]: checked };
                        setWorkspace(next);
                        workspaceMutation.mutate(next);
                      }}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function OrganizationCard({
  org,
  setOrg,
  logo,
  favicon,
  loading,
  saving,
  onSave,
  onUpload,
}: {
  org: typeof EMPTY_ORG;
  setOrg: (next: typeof EMPTY_ORG) => void;
  logo?: string | null;
  favicon?: string | null;
  loading: boolean;
  saving: boolean;
  onSave: () => void;
  onUpload: (kind: "logo" | "favicon", file: File) => void;
}) {
  const field = (key: keyof typeof EMPTY_ORG, label: string, required = false) => (
    <div className="space-y-2">
      <Label>
        {label}
        {required ? " *" : ""}
      </Label>
      <Input
        value={org[key]}
        required={required}
        type={key === "email" ? "email" : "text"}
        onChange={(e) => setOrg({ ...org, [key]: e.target.value })}
      />
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organization</CardTitle>
        <CardDescription>
          Logo, favicon, and company details used across TaskFlow
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <Skeleton className="h-40" />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <BrandUpload
                label="Organization logo"
                hint="PNG, JPG, WebP, or SVG · up to 5 MB. Shown in the sidebar."
                src={logo}
                onFile={(file) => onUpload("logo", file)}
              />
              <BrandUpload
                label="Favicon"
                hint="PNG, SVG, or ICO · up to 1 MB. Browser tab icon."
                src={favicon}
                onFile={(file) => onUpload("favicon", file)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {field("name", "Organization name", true)}
              {field("email", "Organization email", true)}
              {field("phone", "Phone")}
              {field("website", "Website")}
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input
                value={org.address}
                onChange={(e) => setOrg({ ...org, address: e.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {field("city", "City")}
              {field("state", "State / emirate")}
              {field("country", "Country")}
              {field("postalCode", "Postal code")}
              {field("registrationNo", "Registration no.")}
              {field("gstNumber", "GST / VAT no.")}
            </div>
            <Button onClick={onSave} disabled={saving || !org.name.trim() || !org.email.trim()}>
              {saving ? "Saving…" : "Save organization"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function BrandUpload({
  label,
  hint,
  src,
  onFile,
}: {
  label: string;
  hint: string;
  src?: string | null;
  onFile: (file: File) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-md border bg-muted">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" className="h-full w-full object-contain" />
          ) : (
            <Building2 className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
        <div className="space-y-2">
          <Input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon,.ico"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFile(file);
              e.target.value = "";
            }}
          />
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
      </div>
    </div>
  );
}
