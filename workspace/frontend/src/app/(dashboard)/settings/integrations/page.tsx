"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, CircleDashed, Plug } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { integrationsApi } from "@/lib/api";

const PROVIDERS = [
  {
    key: "twilio",
    title: "Twilio Voice",
    description: "Outbound dialing and call status webhooks",
    env: "TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER",
  },
  {
    key: "exotel",
    title: "Exotel",
    description: "Alternate telephony for agent mobile connect",
    env: "EXOTEL_SID, EXOTEL_TOKEN, EXOTEL_CALLER_ID",
  },
  {
    key: "whatsapp",
    title: "WhatsApp Cloud API",
    description: "Send/receive WhatsApp messages on lead/deal threads",
    env: "WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_VERIFY_TOKEN",
  },
  {
    key: "emailSmtp",
    title: "SMTP Email",
    description: "Live outbound email from the Emails tab",
    env: "SMTP_HOST, SMTP_USER, SMTP_PASS",
  },
] as const;

export default function IntegrationsSettingsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["integrations", "status"],
    queryFn: () => integrationsApi.status(),
    retry: false,
  });
  const flags = (data?.data?.data ?? data?.data ?? {}) as Record<string, unknown>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground mb-1">Settings</p>
        <h1 className="font-display text-2xl font-bold">CRM Integrations</h1>
        <p className="text-muted-foreground text-sm">
          Configure env vars on Railway. UI stays usable in log-only mode until connected.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {PROVIDERS.map((p) => {
            const connected = Boolean(flags[p.key]);
            return (
              <Card key={p.key}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <Plug className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <CardTitle className="text-base">{p.title}</CardTitle>
                        <CardDescription>{p.description}</CardDescription>
                      </div>
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
          {flags.telephonyProvider ? (
            <p className="text-sm text-muted-foreground">
              Active telephony provider: <strong>{String(flags.telephonyProvider)}</strong>
            </p>
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Webhook URLs</CardTitle>
              <CardDescription>Point provider callbacks to your API</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1 text-xs font-mono text-muted-foreground">
              <p>POST /api/v1/webhooks/twilio</p>
              <p>POST /api/v1/webhooks/exotel</p>
              <p>GET/POST /api/v1/webhooks/whatsapp</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
