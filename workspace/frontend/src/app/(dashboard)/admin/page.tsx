"use client";

import { Shield, Users, Settings, ScrollText, Lock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { formatRelativeTime } from "@/lib/utils";

const roles = [
  { name: "Admin", permissions: ["All access", "User management", "Billing", "Audit logs"], members: 2 },
  { name: "Manager", permissions: ["Project management", "Team invites", "Reports"], members: 3 },
  { name: "Member", permissions: ["Task management", "Comments", "Documents"], members: 8 },
  { name: "Client", permissions: ["View projects", "Submit forms", "Portal access"], members: 5 },
];

const auditLogs = [
  { id: "1", action: "User role changed", user: "Alex M.", target: "Sarah K. → Manager", time: new Date(Date.now() - 3600000).toISOString() },
  { id: "2", action: "Settings updated", user: "Alex M.", target: "SSO enabled", time: new Date(Date.now() - 86400000).toISOString() },
  { id: "3", action: "User invited", user: "Sarah K.", target: "emily@company.com", time: new Date(Date.now() - 172800000).toISOString() },
];

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" /> Admin Panel
        </h1>
        <p className="text-muted-foreground">Manage roles, settings, and audit logs</p>
      </div>

      <Tabs defaultValue="roles">
        <TabsList>
          <TabsTrigger value="roles"><Users className="h-4 w-4 mr-1" /> Roles</TabsTrigger>
          <TabsTrigger value="settings"><Settings className="h-4 w-4 mr-1" /> Settings</TabsTrigger>
          <TabsTrigger value="audit"><ScrollText className="h-4 w-4 mr-1" /> Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="roles" className="mt-6 space-y-4">
          {roles.map((role) => (
            <Card key={role.name}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{role.name}</CardTitle>
                  <Badge variant="secondary">{role.members} members</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {role.permissions.map((perm) => (
                    <Badge key={perm} variant="outline">{perm}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Workspace Settings</CardTitle>
              <CardDescription>Configure your organization preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {[
                { label: "Require 2FA for all members", desc: "Enforce two-factor authentication", defaultChecked: false },
                { label: "SSO Authentication", desc: "Enable single sign-on via SAML/OIDC", defaultChecked: true },
                { label: "Client portal access", desc: "Allow clients to access their portal", defaultChecked: true },
                { label: "Audit logging", desc: "Track all administrative actions", defaultChecked: true },
              ].map((setting) => (
                <div key={setting.label} className="flex items-center justify-between">
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

        <TabsContent value="audit" className="mt-6">
          <Card>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {auditLogs.map((log) => (
                  <div key={log.id} className="flex items-center gap-4 px-6 py-4">
                    <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm"><span className="font-medium">{log.user}</span> — {log.action}</p>
                      <p className="text-xs text-muted-foreground">{log.target}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{formatRelativeTime(log.time)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
