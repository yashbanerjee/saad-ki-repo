"use client";

import { Shield, Users, Settings, ScrollText, Lock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";

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

        <TabsContent value="roles" className="mt-6">
          <EmptyState
            icon={Users}
            title="No roles configured"
            description="Role definitions will appear here once configured for your workspace."
          />
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
                { label: "SSO Authentication", desc: "Enable single sign-on via SAML/OIDC", defaultChecked: false },
                { label: "Client portal access", desc: "Allow clients to access their portal", defaultChecked: false },
                { label: "Audit logging", desc: "Track all administrative actions", defaultChecked: false },
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
          <EmptyState
            icon={Lock}
            title="No audit logs"
            description="Administrative actions will be recorded here."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
