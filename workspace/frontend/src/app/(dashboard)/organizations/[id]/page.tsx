"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { organizationsApi } from "@/lib/api";

export default function OrganizationDetailPage() {
  const id = String(useParams().id);
  const { data, isLoading } = useQuery({
    queryKey: ["organizations", id],
    queryFn: () => organizationsApi.get(id),
    enabled: !!id,
  });
  const org = data?.data?.data ?? data?.data;

  if (isLoading || !org) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" asChild className="-ml-2 w-fit">
        <Link href="/organizations">
          <ArrowLeft className="h-4 w-4 mr-1" /> Organizations
        </Link>
      </Button>
      <div>
        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground mb-1">CRM</p>
        <h1 className="font-display text-2xl font-bold">{org.name}</h1>
        <p className="text-muted-foreground text-sm">
          {[org.industry, org.website, org.city].filter(Boolean).join(" · ")}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contacts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(org.contacts ?? []).map(
              (c: { id: string; firstName: string; lastName?: string }) => (
                <Link
                  key={c.id}
                  href={`/contacts/${c.id}`}
                  className="block text-primary hover:underline"
                >
                  {[c.firstName, c.lastName].filter(Boolean).join(" ")}
                </Link>
              ),
            )}
            {!org.contacts?.length && (
              <p className="text-muted-foreground">No contacts</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Leads</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(org.leads ?? []).map((l: { id: string; title: string }) => (
              <Link key={l.id} href={`/leads/${l.id}`} className="block text-primary hover:underline">
                {l.title}
              </Link>
            ))}
            {!org.leads?.length && <p className="text-muted-foreground">No leads</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Deals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(org.deals ?? []).map((d: { id: string; title: string }) => (
              <Link key={d.id} href="/deals" className="block text-primary hover:underline">
                {d.title}
              </Link>
            ))}
            {!org.deals?.length && <p className="text-muted-foreground">No deals</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
