"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { contactsApi } from "@/lib/api";

export default function ContactDetailPage() {
  const id = String(useParams().id);
  const { data, isLoading } = useQuery({
    queryKey: ["contacts", id],
    queryFn: () => contactsApi.get(id),
    enabled: !!id,
  });
  const contact = data?.data?.data ?? data?.data;

  if (isLoading || !contact) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" asChild className="-ml-2 w-fit">
        <Link href="/contacts">
          <ArrowLeft className="h-4 w-4 mr-1" /> Contacts
        </Link>
      </Button>
      <div>
        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground mb-1">CRM</p>
        <h1 className="font-display text-2xl font-bold">
          {[contact.firstName, contact.lastName].filter(Boolean).join(" ")}
        </h1>
        {contact.jobTitle && <p className="text-muted-foreground">{contact.jobTitle}</p>}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {contact.email && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-3.5 w-3.5" />
                {contact.email}
              </div>
            )}
            {(contact.mobile || contact.phone) && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-3.5 w-3.5" />
                {contact.mobile || contact.phone}
              </div>
            )}
            {contact.organization && (
              <p>
                Org:{" "}
                <Link
                  href={`/organizations/${contact.organization.id}`}
                  className="text-primary hover:underline"
                >
                  {contact.organization.name}
                </Link>
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Linked records</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(contact.leads ?? []).map((l: { id: string; title: string }) => (
              <Link key={l.id} href={`/leads/${l.id}`} className="block text-primary hover:underline">
                Lead: {l.title}
              </Link>
            ))}
            {(contact.deals ?? []).map((d: { id: string; title: string }) => (
              <Link key={d.id} href="/deals" className="block text-primary hover:underline">
                Deal: {d.title}
              </Link>
            ))}
            {!contact.leads?.length && !contact.deals?.length && (
              <p className="text-muted-foreground">No linked leads or deals</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
