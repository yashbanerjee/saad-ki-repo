"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
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
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { hasRole, isClientUser, useAuthStore } from "@/lib/auth-store";
import { useSidebarStore } from "@/lib/sidebar-store";
import { integrationsApi } from "@/lib/api";
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
  clientActivity: false,
  emailReceive: true,
  emailDigest: false,
  push: true,
};

function prefsKey(userId?: string) {
  return `taskflow-settings-${userId || "anon"}`;
}

function loadPrefs(userId?: string): NotifPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(prefsKey(userId));
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<NotifPrefs>) };
  } catch {
    return DEFAULT_PREFS;
  }
}

const INTEGRATION_PROVIDERS = [
  {
    key: "emailSmtp",
    title: "SMTP Email",
    description: "Outbound mail for invites, invoices, and notifications",
    env: "SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM",
  },
  {
    key: "twilio",
    title: "Twilio Voice",
    description: "Outbound dialing and call status webhooks",
    env: "TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER",
  },
  {
    key: "whatsapp",
    title: "WhatsApp Cloud API",
    description: "Send and receive WhatsApp on lead and deal threads",
    env: "WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_VERIFY_TOKEN",
  },
] as const;

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const { theme, setTheme } = useTheme();
  const user = useAuthStore((s) => s.user);
  const collapsed = useSidebarStore((s) => s.collapsed);
  const setCollapsed = useSidebarStore((s) => s.setCollapsed);
  const isClient = isClientUser(user);
  const isAdmin = hasRole(user, ["admin"]);
  const canManageMail = hasRole(user, ["admin", "manager"]);
  const tabFromUrl = searchParams.get("tab") || "profile";
  const [tab, setTab] = useState(tabFromUrl);
  const [prefs, setPrefs] = useState<NotifPrefs>(() => loadPrefs(user?.id));

  useEffect(() => {
    setPrefs(loadPrefs(user?.id));
  }, [user?.id]);

  useEffect(() => {
    const next = searchParams.get("tab");
    if (next) setTab(next);
  }, [searchParams]);

  const { data: integrationData, isLoading: integrationsLoading } = useQuery({
    queryKey: ["integrations", "status"],
    queryFn: () => integrationsApi.status(),
    retry: false,
    enabled: canManageMail,
  });
  const flags = (integrationData?.data?.data ?? integrationData?.data ?? {}) as Record<
    string,
    unknown
  >;

  const savePrefs = (next: NotifPrefs) => {
    setPrefs(next);
    if (typeof window !== "undefined") {
      localStorage.setItem(prefsKey(user?.id), JSON.stringify(next));
    }
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

        <TabsContent value="profile" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Your account details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Full name</Label>
                  <Input defaultValue={user?.name || ""} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input defaultValue={user?.email || ""} type="email" disabled />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Company</Label>
                <Input defaultValue={user?.companyName || ""} disabled />
              </div>
              <p className="text-xs text-muted-foreground capitalize">Role: {user?.role}</p>
              <Button onClick={() => toast.success("Profile saved")}>Save changes</Button>
            </CardContent>
          </Card>
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
                { key: "assignments" as const, label: "Issue assignments", desc: "When a task is assigned to you" },
                { key: "projects" as const, label: "Project updates", desc: "Milestones, status changes, and board activity" },
                { key: "comments" as const, label: "Comments & mentions", desc: "When someone mentions you" },
                ...(!isClient
                  ? [
                      {
                        key: "clientActivity" as const,
                        label: "Client activity",
                        desc: "Portal uploads, form submissions, and logins",
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
                      onClick={() => setTheme(t)}
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
                <Switch checked={collapsed} onCheckedChange={setCollapsed} />
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
                <Input type="password" autoComplete="current-password" />
              </div>
              <div className="space-y-2">
                <Label>New password</Label>
                <Input type="password" autoComplete="new-password" />
              </div>
              <div className="space-y-2">
                <Label>Confirm new password</Label>
                <Input type="password" autoComplete="new-password" />
              </div>
              <Button onClick={() => toast.success("Password updated")}>Update password</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {canManageMail && (
          <TabsContent value="email" className="mt-6 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>SMTP outbound mail</CardTitle>
                <CardDescription>
                  Used for invites, invoices, and notification emails. Configure on the server.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {integrationsLoading ? (
                  <Skeleton className="h-12" />
                ) : (
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <Label>SMTP connection</Label>
                      <p className="text-xs text-muted-foreground font-mono">
                        SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
                      </p>
                    </div>
                    <Badge variant={flags.emailSmtp ? "success" : "secondary"} className="gap-1">
                      {flags.emailSmtp ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (
                        <CircleDashed className="h-3 w-3" />
                      )}
                      {flags.emailSmtp ? "Connected" : "Not configured"}
                    </Badge>
                  </div>
                )}
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
                    checked={prefs.emailReceive}
                    onCheckedChange={(checked) => savePrefs({ ...prefs, emailReceive: checked })}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {canManageMail && (
          <TabsContent value="integrations" className="mt-6">
            <div className="space-y-3">
              {integrationsLoading
                ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)
                : INTEGRATION_PROVIDERS.map((p) => {
                    const connected = Boolean(flags[p.key]);
                    return (
                      <Card key={p.key}>
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <CardTitle className="text-base">{p.title}</CardTitle>
                              <CardDescription>{p.description}</CardDescription>
                            </div>
                            <Badge variant={connected ? "success" : "secondary"} className="gap-1">
                              {connected ? (
                                <CheckCircle2 className="h-3 w-3" />
                              ) : (
                                <CircleDashed className="h-3 w-3" />
                              )}
                              {connected ? "Connected" : "Not configured"}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="text-xs text-muted-foreground font-mono">
                          {p.env}
                        </CardContent>
                      </Card>
                    );
                  })}
            </div>
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
                {[
                  {
                    label: "Client portal access",
                    desc: "Allow linked clients to use their project portal",
                    defaultChecked: true,
                  },
                  {
                    label: "Require 2FA for staff",
                    desc: "Ask admins and managers for two-factor on next login",
                    defaultChecked: false,
                  },
                  {
                    label: "Audit logging",
                    desc: "Record administrative actions in the audit log",
                    defaultChecked: true,
                  },
                ].map((setting) => (
                  <div key={setting.label} className="flex items-center justify-between gap-4">
                    <div>
                      <Label>{setting.label}</Label>
                      <p className="text-xs text-muted-foreground">{setting.desc}</p>
                    </div>
                    <Switch defaultChecked={setting.defaultChecked} />
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
