"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckSquare,
  FileText,
  LayoutGrid,
  Mail,
  MessageCircle,
  Paperclip,
  Phone,
  Send,
  StickyNote,
  Target,
  Trash2,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CrmDetailLayout } from "@/components/crm/CrmDetailLayout";
import { CrmActivityFeed } from "@/components/crm/CrmActivityFeed";
import { LEAD_STATUSES } from "@/components/crm/crm-constants";
import {
  crmCommsApi,
  crmNotesApi,
  crmTasksApi,
  integrationsApi,
  leadsApi,
} from "@/lib/api";
import { toast } from "sonner";
import { useConfirm, trashConfirm } from "@/providers/confirm-provider";

export default function LeadDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const router = useRouter();
  const queryClient = useQueryClient();
  const confirm = useConfirm();

  const [comment, setComment] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailTo, setEmailTo] = useState("");
  const [callTo, setCallTo] = useState("");
  const [callNotes, setCallNotes] = useState("");
  const [waBody, setWaBody] = useState("");
  const [waTo, setWaTo] = useState("");
  const [attachName, setAttachName] = useState("");
  const [attachUrl, setAttachUrl] = useState("");
  const [convertOpen, setConvertOpen] = useState(false);
  const [convertType, setConvertType] = useState<"COMPANY" | "INDIVIDUAL">("COMPANY");
  const [createDeal, setCreateDeal] = useState(true);

  const { data, isLoading } = useQuery({
    queryKey: ["leads", id],
    queryFn: () => leadsApi.get(id),
    enabled: !!id,
    retry: false,
  });
  const lead = data?.data?.data ?? data?.data;

  const { data: flagsRes } = useQuery({
    queryKey: ["integrations", "status"],
    queryFn: () => integrationsApi.status(),
    retry: false,
  });
  const flags = flagsRes?.data?.data ?? flagsRes?.data ?? {};

  const { data: emailsRes, refetch: refetchEmails } = useQuery({
    queryKey: ["crm", "emails", id],
    queryFn: () => crmCommsApi.listEmails({ leadId: id, limit: 50 }),
    enabled: !!id,
  });
  const { data: callsRes, refetch: refetchCalls } = useQuery({
    queryKey: ["crm", "calls", id],
    queryFn: () => crmCommsApi.listCalls({ leadId: id, limit: 50 }),
    enabled: !!id,
  });
  const { data: waRes, refetch: refetchWa } = useQuery({
    queryKey: ["crm", "whatsapp", id],
    queryFn: () => crmCommsApi.listWhatsApp({ leadId: id, limit: 100 }),
    enabled: !!id,
  });
  const { data: attachRes, refetch: refetchAttach } = useQuery({
    queryKey: ["crm", "attachments", id],
    queryFn: () => crmCommsApi.listAttachments({ leadId: id, limit: 50 }),
    enabled: !!id,
  });

  const emails = useMemo(() => {
    const raw = emailsRes?.data?.data ?? emailsRes?.data ?? [];
    return Array.isArray(raw) ? raw : [];
  }, [emailsRes]);
  const calls = useMemo(() => {
    const raw = callsRes?.data?.data ?? callsRes?.data ?? [];
    return Array.isArray(raw) ? raw : [];
  }, [callsRes]);
  const waMessages = useMemo(() => {
    const raw = waRes?.data?.data ?? waRes?.data ?? [];
    return Array.isArray(raw) ? raw : [];
  }, [waRes]);
  const attachments = useMemo(() => {
    const raw = attachRes?.data?.data ?? attachRes?.data ?? [];
    return Array.isArray(raw) ? raw : [];
  }, [attachRes]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["leads", id] });
    queryClient.invalidateQueries({ queryKey: ["leads"] });
  };

  const statusMutation = useMutation({
    mutationFn: (status: string) => leadsApi.update(id, { status }),
    onSuccess: () => {
      invalidate();
      toast.success("Status updated");
    },
  });

  const commentMutation = useMutation({
    mutationFn: () => leadsApi.addActivity(id, { type: "COMMENT", body: comment }),
    onSuccess: () => {
      setComment("");
      invalidate();
      toast.success("Comment added");
    },
  });

  const noteMutation = useMutation({
    mutationFn: () =>
      crmNotesApi.create({ leadId: id, title: noteTitle || undefined, body: noteBody }),
    onSuccess: () => {
      setNoteTitle("");
      setNoteBody("");
      invalidate();
      toast.success("Note saved");
    },
  });

  const taskMutation = useMutation({
    mutationFn: () =>
      crmTasksApi.create({
        leadId: id,
        title: taskTitle,
        dueDate: taskDue || undefined,
      }),
    onSuccess: () => {
      setTaskTitle("");
      setTaskDue("");
      invalidate();
      toast.success("Task created");
    },
  });

  const emailMutation = useMutation({
    mutationFn: (send: boolean) =>
      crmCommsApi.createEmail({
        leadId: id,
        subject: emailSubject,
        body: emailBody,
        toAddress: emailTo || lead?.email,
        send,
      }),
    onSuccess: () => {
      setEmailSubject("");
      setEmailBody("");
      invalidate();
      refetchEmails();
      toast.success("Email logged");
    },
  });

  const callMutation = useMutation({
    mutationFn: (dial: boolean) =>
      crmCommsApi.createCall({
        leadId: id,
        toNumber: callTo || lead?.mobile || lead?.phone,
        notes: callNotes || undefined,
        dial,
      }),
    onSuccess: () => {
      setCallNotes("");
      invalidate();
      refetchCalls();
      toast.success("Call logged");
    },
  });

  const waMutation = useMutation({
    mutationFn: (send: boolean) =>
      crmCommsApi.createWhatsApp({
        leadId: id,
        body: waBody,
        toNumber: waTo || lead?.mobile || lead?.phone,
        send,
      }),
    onSuccess: () => {
      setWaBody("");
      invalidate();
      refetchWa();
      toast.success("WhatsApp message saved");
    },
  });

  const attachMutation = useMutation({
    mutationFn: () =>
      crmCommsApi.createAttachment({
        leadId: id,
        fileName: attachName,
        fileUrl: attachUrl,
      }),
    onSuccess: () => {
      setAttachName("");
      setAttachUrl("");
      refetchAttach();
      toast.success("Attachment added");
    },
  });

  const convertMutation = useMutation({
    mutationFn: () =>
      leadsApi.convert(id, {
        type: convertType,
        createDeal,
        dealTitle: lead ? `${lead.title} — Deal` : undefined,
        dealAmount: lead?.estimatedValue ? Number(lead.estimatedValue) : undefined,
      }),
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      toast.success("Converted to client");
      setConvertOpen(false);
      router.push("/clients");
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Conversion failed";
      toast.error(Array.isArray(message) ? message.join(", ") : message);
    },
  });

  const convertDealMutation = useMutation({
    mutationFn: () => leadsApi.convertToDeal(id, { createClient: true }),
    onSuccess: (res) => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      toast.success("Converted to deal");
      const dealId = res.data?.deal?.id ?? res.data?.data?.deal?.id;
      if (dealId) router.push(`/deals/${dealId}`);
      else router.push("/deals");
    },
    onError: () => toast.error("Could not convert to deal"),
  });

  const boardMutation = useMutation({
    mutationFn: (onBoard: boolean) =>
      onBoard ? leadsApi.moveToBoard([id]) : leadsApi.removeFromBoard([id]),
    onSuccess: (_res, onBoard) => {
      invalidate();
      toast.success(onBoard ? "Moved to the board" : "Moved back to leads");
      router.push(onBoard ? "/leads/board" : "/leads");
    },
    onError: () => toast.error("Could not move this lead"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => leadsApi.remove(id),
    onSuccess: () => {
      toast.success("Lead moved to trash");
      router.push("/leads");
    },
    onError: () => toast.error("Could not delete lead"),
  });

  if (isLoading || !lead) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[480px] w-full" />
      </div>
    );
  }

  const converted = !!lead.convertedClientId || lead.status === "WON";
  const comments = (lead.activities ?? []).filter((a: { type: string }) => a.type === "COMMENT");
  const events = (lead.crmTasks ?? []).filter((t: { dueDate?: string }) => t.dueDate);

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" asChild className="-ml-2 w-fit">
        <Link href="/leads">
          <ArrowLeft className="h-4 w-4 mr-1" /> Leads
        </Link>
      </Button>

      <CrmDetailLayout
        header={
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1.5 min-w-0">
              <h1 className="font-display text-xl font-bold truncate">{lead.title}</h1>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{lead.status}</Badge>
                <Badge variant="outline">
                  {lead.type === "INDIVIDUAL" ? "Individual" : "Company"}
                </Badge>
                <Badge variant="outline">{String(lead.source || "").replace(/_/g, " ")}</Badge>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Select
                value={lead.status}
                onValueChange={(v) => statusMutation.mutate(v)}
                disabled={converted && lead.status === "WON"}
              >
                <SelectTrigger className="w-36 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_STATUSES.map((s) => (
                    <SelectItem key={s.key} value={s.key}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                disabled={converted}
                onClick={() => convertDealMutation.mutate()}
              >
                Convert to Deal
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={boardMutation.isPending}
                onClick={() => boardMutation.mutate(!lead.onBoard)}
              >
                {lead.onBoard ? (
                  <>
                    <Target className="h-4 w-4 mr-1" /> Move to leads
                  </>
                ) : (
                  <>
                    <LayoutGrid className="h-4 w-4 mr-1" /> Move to board
                  </>
                )}
              </Button>
              <Button
                size="sm"
                disabled={converted}
                onClick={() => {
                  setConvertType(lead.type ?? "COMPANY");
                  setConvertOpen(true);
                }}
              >
                Convert to Client
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={async () => {
                  const ok = await confirm(trashConfirm("lead", lead.title));
                  if (ok) deleteMutation.mutate();
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        }
        sidePanel={
          <>
            <div>
              <p className="text-xs uppercase text-muted-foreground mb-2">Details</p>
              <div className="space-y-2.5 text-sm">
                <div className="flex items-center gap-2">
                  {lead.type === "INDIVIDUAL" ? (
                    <User className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span>{lead.name}</span>
                </div>
                {lead.organizationName && (
                  <p className="text-muted-foreground pl-6">{lead.organizationName}</p>
                )}
                {lead.jobTitle && <p className="text-muted-foreground pl-6">{lead.jobTitle}</p>}
                {lead.email && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" />
                    {lead.email}
                  </div>
                )}
                {(lead.phone || lead.mobile) && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" />
                    {lead.mobile || lead.phone}
                  </div>
                )}
                {lead.website && (
                  <a
                    href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline block pl-6"
                  >
                    {lead.website}
                  </a>
                )}
                {lead.estimatedValue != null && (
                  <p className="pt-2 font-medium">
                    Est. ${Number(lead.estimatedValue).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
            {lead.owner && (
              <div>
                <p className="text-xs uppercase text-muted-foreground mb-1">Owner</p>
                <p className="text-sm">
                  {[lead.owner.firstName, lead.owner.lastName].filter(Boolean).join(" ")}
                </p>
              </div>
            )}
            {lead.convertedClient && (
              <div className="pt-2 border-t">
                <p className="text-xs uppercase text-muted-foreground mb-1">Client</p>
                <Link href="/clients" className="text-sm text-primary hover:underline">
                  {lead.convertedClient.name}
                </Link>
              </div>
            )}
            {lead.notes && (
              <div className="pt-2 border-t">
                <p className="text-xs uppercase text-muted-foreground mb-1">Summary</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{lead.notes}</p>
              </div>
            )}
          </>
        }
        tabs={[
          {
            id: "activity",
            label: "Activity",
            icon: <FileText className="h-3.5 w-3.5" />,
            content: <CrmActivityFeed items={lead.activities ?? []} />,
          },
          {
            id: "emails",
            label: "Emails",
            icon: <Mail className="h-3.5 w-3.5" />,
            content: (
              <div className="space-y-4">
                <div className="space-y-2 rounded-lg border p-3">
                  <Input
                    placeholder="To"
                    value={emailTo || lead.email || ""}
                    onChange={(e) => setEmailTo(e.target.value)}
                  />
                  <Input
                    placeholder="Subject"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                  />
                  <Textarea
                    placeholder="Message"
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!emailSubject || !emailBody || emailMutation.isPending}
                      onClick={() => emailMutation.mutate(false)}
                    >
                      Log email
                    </Button>
                    <Button
                      size="sm"
                      disabled={
                        !flags.emailSmtp || !emailSubject || !emailBody || emailMutation.isPending
                      }
                      onClick={() => emailMutation.mutate(true)}
                    >
                      Send
                    </Button>
                  </div>
                  {!flags.emailSmtp && (
                    <p className="text-xs text-muted-foreground">
                      SMTP not configured — logging only.
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  {emails.map((e: { id: string; subject: string; body: string; status: string; createdAt: string }) => (
                    <div key={e.id} className="rounded-lg border px-3 py-2 text-sm">
                      <div className="flex justify-between gap-2">
                        <p className="font-medium">{e.subject}</p>
                        <Badge variant="outline" className="text-[10px]">{e.status}</Badge>
                      </div>
                      <p className="text-muted-foreground mt-1 line-clamp-3">{e.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            ),
          },
          {
            id: "comments",
            label: "Comments",
            icon: <MessageCircle className="h-3.5 w-3.5" />,
            content: (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Write a comment…"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                  <Button
                    size="icon"
                    disabled={!comment.trim() || commentMutation.isPending}
                    onClick={() => commentMutation.mutate()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <CrmActivityFeed items={comments} />
              </div>
            ),
          },
          {
            id: "data",
            label: "Data",
            icon: <FileText className="h-3.5 w-3.5" />,
            content: (
              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                {[
                  ["Title", lead.title],
                  ["Name", lead.name],
                  ["Email", lead.email],
                  ["Phone", lead.phone],
                  ["Mobile", lead.mobile],
                  ["Website", lead.website],
                  ["Organization", lead.organizationName],
                  ["Source", lead.source],
                  ["Status", lead.status],
                  ["Type", lead.type],
                ].map(([k, v]) => (
                  <div key={String(k)} className="rounded-lg border px-3 py-2">
                    <p className="text-xs text-muted-foreground">{k}</p>
                    <p className="font-medium break-all">{v || "—"}</p>
                  </div>
                ))}
              </div>
            ),
          },
          {
            id: "events",
            label: "Events",
            icon: <Calendar className="h-3.5 w-3.5" />,
            content:
              events.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Tasks with due dates appear here as events.
                </p>
              ) : (
                <div className="space-y-2">
                  {events.map((t: { id: string; title: string; dueDate: string; status: string }) => (
                    <div key={t.id} className="rounded-lg border px-3 py-2 text-sm flex justify-between">
                      <span>{t.title}</span>
                      <span className="text-muted-foreground">
                        {new Date(t.dueDate).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              ),
          },
          {
            id: "calls",
            label: "Calls",
            icon: <Phone className="h-3.5 w-3.5" />,
            content: (
              <div className="space-y-4">
                <div className="space-y-2 rounded-lg border p-3">
                  <Input
                    placeholder="Phone number"
                    value={callTo || lead.mobile || lead.phone || ""}
                    onChange={(e) => setCallTo(e.target.value)}
                  />
                  <Textarea
                    placeholder="Call notes"
                    value={callNotes}
                    onChange={(e) => setCallNotes(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={callMutation.isPending}
                      onClick={() => callMutation.mutate(false)}
                    >
                      Log call
                    </Button>
                    <Button
                      size="sm"
                      disabled={
                        !(flags.twilio || flags.exotel) || callMutation.isPending
                      }
                      onClick={() => callMutation.mutate(true)}
                    >
                      Dial
                    </Button>
                  </div>
                  {!(flags.twilio || flags.exotel) && (
                    <p className="text-xs text-muted-foreground">
                      Twilio/Exotel not configured — logging only.
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  {calls.map((c: { id: string; toNumber?: string; status: string; notes?: string; createdAt: string }) => (
                    <div key={c.id} className="rounded-lg border px-3 py-2 text-sm">
                      <div className="flex justify-between">
                        <span>{c.toNumber || "Call"}</span>
                        <Badge variant="outline" className="text-[10px]">{c.status}</Badge>
                      </div>
                      {c.notes && <p className="text-muted-foreground mt-1">{c.notes}</p>}
                    </div>
                  ))}
                </div>
              </div>
            ),
          },
          {
            id: "tasks",
            label: "Tasks",
            icon: <CheckSquare className="h-3.5 w-3.5" />,
            content: (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Input
                    className="flex-1 min-w-[180px]"
                    placeholder="Task title"
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                  />
                  <Input
                    type="datetime-local"
                    value={taskDue}
                    onChange={(e) => setTaskDue(e.target.value)}
                  />
                  <Button
                    disabled={!taskTitle || taskMutation.isPending}
                    onClick={() => taskMutation.mutate()}
                  >
                    Add
                  </Button>
                </div>
                <div className="space-y-2">
                  {(lead.crmTasks ?? []).map(
                    (t: { id: string; title: string; status: string; dueDate?: string }) => (
                      <div
                        key={t.id}
                        className="rounded-lg border px-3 py-2 text-sm flex items-center justify-between gap-2"
                      >
                        <span>{t.title}</span>
                        <div className="flex items-center gap-2">
                          {t.dueDate && (
                            <span className="text-xs text-muted-foreground">
                              {new Date(t.dueDate).toLocaleDateString()}
                            </span>
                          )}
                          <Badge variant="outline" className="text-[10px]">
                            {t.status}
                          </Badge>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </div>
            ),
          },
          {
            id: "notes",
            label: "Notes",
            icon: <StickyNote className="h-3.5 w-3.5" />,
            content: (
              <div className="space-y-4">
                <div className="space-y-2 rounded-lg border p-3">
                  <Input
                    placeholder="Title (optional)"
                    value={noteTitle}
                    onChange={(e) => setNoteTitle(e.target.value)}
                  />
                  <Textarea
                    placeholder="Note"
                    value={noteBody}
                    onChange={(e) => setNoteBody(e.target.value)}
                  />
                  <Button
                    size="sm"
                    disabled={!noteBody.trim() || noteMutation.isPending}
                    onClick={() => noteMutation.mutate()}
                  >
                    Save note
                  </Button>
                </div>
                <div className="space-y-2">
                  {(lead.crmNotes ?? []).map(
                    (n: { id: string; title?: string; body: string; createdAt: string }) => (
                      <div key={n.id} className="rounded-lg border px-3 py-2 text-sm">
                        {n.title && <p className="font-medium mb-1">{n.title}</p>}
                        <p className="whitespace-pre-wrap">{n.body}</p>
                      </div>
                    ),
                  )}
                </div>
              </div>
            ),
          },
          {
            id: "attachments",
            label: "Attachments",
            icon: <Paperclip className="h-3.5 w-3.5" />,
            content: (
              <div className="space-y-4">
                <div className="space-y-2 rounded-lg border p-3">
                  <Input
                    placeholder="File name"
                    value={attachName}
                    onChange={(e) => setAttachName(e.target.value)}
                  />
                  <Input
                    placeholder="File URL"
                    value={attachUrl}
                    onChange={(e) => setAttachUrl(e.target.value)}
                  />
                  <Button
                    size="sm"
                    disabled={!attachName || !attachUrl || attachMutation.isPending}
                    onClick={() => attachMutation.mutate()}
                  >
                    Add attachment
                  </Button>
                </div>
                <div className="space-y-2">
                  {attachments.map((a: { id: string; fileName: string; fileUrl: string }) => (
                    <a
                      key={a.id}
                      href={a.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-lg border px-3 py-2 text-sm hover:bg-muted/40"
                    >
                      {a.fileName}
                    </a>
                  ))}
                </div>
              </div>
            ),
          },
          {
            id: "whatsapp",
            label: "WhatsApp",
            icon: <MessageCircle className="h-3.5 w-3.5" />,
            content: (
              <div className="space-y-4">
                <div className="max-h-[320px] overflow-y-auto space-y-2 rounded-lg border p-3 bg-muted/20">
                  {waMessages.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No WhatsApp messages yet
                    </p>
                  ) : (
                    waMessages.map(
                      (m: {
                        id: string;
                        body: string;
                        direction: string;
                        createdAt: string;
                      }) => (
                        <div
                          key={m.id}
                          className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                            m.direction === "OUTBOUND"
                              ? "ml-auto bg-primary text-primary-foreground"
                              : "bg-background border"
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{m.body}</p>
                          <p className="text-[10px] opacity-70 mt-1">
                            {new Date(m.createdAt).toLocaleString()}
                          </p>
                        </div>
                      ),
                    )
                  )}
                </div>
                <Input
                  placeholder="To number"
                  value={waTo || lead.mobile || lead.phone || ""}
                  onChange={(e) => setWaTo(e.target.value)}
                />
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Message"
                    value={waBody}
                    onChange={(e) => setWaBody(e.target.value)}
                  />
                  <div className="flex flex-col gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!waBody.trim() || waMutation.isPending}
                      onClick={() => waMutation.mutate(false)}
                    >
                      Log
                    </Button>
                    <Button
                      size="sm"
                      disabled={!flags.whatsapp || !waBody.trim() || waMutation.isPending}
                      onClick={() => waMutation.mutate(true)}
                    >
                      Send
                    </Button>
                  </div>
                </div>
                {!flags.whatsapp && (
                  <p className="text-xs text-muted-foreground">
                    WhatsApp Cloud API not configured — logging only.
                  </p>
                )}
              </div>
            ),
          },
        ]}
      />

      <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convert lead to client</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Client type</Label>
              <Select
                value={convertType}
                onValueChange={(v) => setConvertType(v as "COMPANY" | "INDIVIDUAL")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="COMPANY">Company</SelectItem>
                  <SelectItem value="INDIVIDUAL">Individual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={createDeal}
                onCheckedChange={(checked) => setCreateDeal(checked === true)}
              />
              Also create an open deal
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!lead.email || convertMutation.isPending}
              onClick={() => convertMutation.mutate()}
            >
              {convertMutation.isPending ? "Converting..." : "Convert"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
