import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "./auth-store";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

export const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 30000,
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else if (token) prom.resolve(token);
  });
  failedQueue = [];
}

function extractTokens(payload: Record<string, unknown>) {
  const nested =
    payload.data && typeof payload.data === "object"
      ? (payload.data as Record<string, unknown>)
      : null;
  const accessToken =
    (typeof payload.accessToken === "string" && payload.accessToken) ||
    (typeof nested?.accessToken === "string" && nested.accessToken) ||
    null;
  const refreshToken =
    (typeof payload.refreshToken === "string" && payload.refreshToken) ||
    (typeof nested?.refreshToken === "string" && nested.refreshToken) ||
    null;
  return { accessToken, refreshToken };
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Let the browser set multipart boundary for FormData
  if (typeof FormData !== "undefined" && config.data instanceof FormData) {
    if (config.headers) {
      if (typeof config.headers.delete === "function") {
        config.headers.delete("Content-Type");
      } else {
        delete (config.headers as Record<string, unknown>)["Content-Type"];
        delete (config.headers as Record<string, unknown>)["content-type"];
      }
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (!originalRequest) return Promise.reject(error);

    const url = originalRequest.url || "";
    const isAuthEndpoint =
      url.includes("/auth/login") ||
      url.includes("/auth/refresh") ||
      url.includes("/auth/register");

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${token}`;
          }
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = useAuthStore.getState().refreshToken;
      if (!refreshToken) {
        isRefreshing = false;
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(
          `${API_URL}/auth/refresh`,
          { refreshToken },
          { headers: { "Content-Type": "application/json" }, timeout: 15000 },
        );
        const payload =
          data && typeof data === "object" ? (data as Record<string, unknown>) : {};
        const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
          extractTokens(payload);

        if (!newAccessToken) {
          throw new Error("Refresh response missing access token");
        }

        useAuthStore.getState().setTokens(newAccessToken, newRefreshToken ?? undefined);
        if (typeof document !== "undefined") {
          document.cookie = `taskflow-auth-token=${newAccessToken}; path=/; max-age=604800; SameSite=Lax`;
        }
        processQueue(null, newAccessToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        useAuthStore.getState().logout();
        if (typeof document !== "undefined") {
          document.cookie = "taskflow-auth-token=; path=/; max-age=0";
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: (identifier: string, password: string) =>
    api.post("/auth/login", { identifier, email: identifier.includes("@") ? identifier : undefined, password }),
  register: (data: {
    companyName: string;
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  }) => api.post("/auth/register-company", data),
  registerClient: (data: {
    firstName: string;
    lastName?: string;
    email?: string;
    phone?: string;
    password: string;
    portalToken?: string;
    setupToken?: string;
  }) => api.post("/auth/register-client", data),
  forgotPassword: (email: string) =>
    api.post("/auth/forgot-password", { email }),
  resetPassword: (token: string, password: string) =>
    api.post("/auth/reset-password", { token, password }),
  me: () => api.get("/auth/me"),
  logout: () => api.post("/auth/logout"),
};

// Projects API
export const projectsApi = {
  list: (params?: Record<string, unknown>) =>
    api.get("/projects", { params }),
  listTags: () => api.get("/projects/tags"),
  myClientProjects: () => api.get("/projects/my/client"),
  get: (id: string) => api.get(`/projects/${id}`),
  create: (data: Record<string, unknown>) => api.post("/projects", data),
  update: (id: string, data: Record<string, unknown>) =>
    api.patch(`/projects/${id}`, data),
  delete: (id: string) => api.delete(`/projects/${id}`),
  getBoard: (id: string) => api.get(`/projects/${id}/board`),
  updateTaskStatus: (projectId: string, taskId: string, status: string) =>
    api
      .patch(`/projects/${projectId}/tasks/${taskId}`, { status })
      .catch(() => api.post(`/issues/${taskId}/transition`, { status })),
  enablePortal: (id: string) => api.post(`/projects/${id}/portal/enable`),
  rotatePortal: (id: string) => api.post(`/projects/${id}/portal/rotate`),
  disablePortal: (id: string) => api.post(`/projects/${id}/portal/disable`),
  listMilestones: (id: string) => api.get(`/projects/${id}/milestones`),
  createMilestone: (id: string, data: Record<string, unknown>) =>
    api.post(`/projects/${id}/milestones`, data),
  updateMilestone: (id: string, milestoneId: string, data: Record<string, unknown>) =>
    api.patch(`/projects/${id}/milestones/${milestoneId}`, data),
  deleteMilestone: (id: string, milestoneId: string) =>
    api.delete(`/projects/${id}/milestones/${milestoneId}`),
  listClientTasks: (id: string) => api.get(`/projects/${id}/client-tasks`),
  createClientTask: (id: string, data: Record<string, unknown>) =>
    api.post(`/projects/${id}/client-tasks`, data),
  updateClientTask: (id: string, taskId: string, data: Record<string, unknown>) =>
    api.patch(`/projects/${id}/client-tasks/${taskId}`, data),
  deleteClientTask: (id: string, taskId: string) =>
    api.delete(`/projects/${id}/client-tasks/${taskId}`),
};

export const portalApi = {
  get: (token: string) => api.get(`/portal/${token}`),
  createMilestone: (token: string, data: Record<string, unknown>) =>
    api.post(`/portal/${token}/milestones`, data),
  createTask: (token: string, data: Record<string, unknown>) =>
    api.post(`/portal/${token}/tasks`, data),
  addLink: (token: string, data: { name: string; url: string }) =>
    api.post(`/portal/${token}/links`, data),
  uploadDocument: (token: string, file: File, name?: string) => {
    const formData = new FormData();
    formData.append("file", file);
    if (name) formData.append("name", name);
    return api.post(`/portal/${token}/documents`, formData, {
      timeout: 120000,
    });
  },
  downloadDocument: (token: string, documentId: string) =>
    api.get(`/portal/${token}/documents/${documentId}/download`, {
      timeout: 120000,
    }),
};

// Issues API
export const issuesApi = {
  list: (params?: Record<string, unknown>) =>
    api.get("/issues", { params }),
  get: (id: string) => api.get(`/issues/${id}`),
  create: (data: Record<string, unknown>) => api.post("/issues", data),
  update: (id: string, data: Record<string, unknown>) =>
    api.patch(`/issues/${id}`, data),
  transition: (id: string, status: string) =>
    api.post(`/issues/${id}/transition`, { status }),
  addComment: (id: string, body: string) =>
    api.post(`/issues/${id}/comments`, { body }),
  uploadAttachment: (id: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post(`/issues/${id}/attachments`, formData, {
      timeout: 120000,
    });
  },
  deleteAttachment: (id: string, attachmentId: string) =>
    api.delete(`/issues/${id}/attachments/${attachmentId}`),
  listTimeEntries: (id: string) => api.get(`/issues/${id}/time-entries`),
  addTimeEntry: (
    id: string,
    data: { hours: number; description?: string; date?: string },
  ) => api.post(`/issues/${id}/time-entries`, data),
  removeTimeEntry: (id: string, entryId: string) =>
    api.delete(`/issues/${id}/time-entries/${entryId}`),
};

// Clients API
export const clientsApi = {
  list: (params?: { type?: string; search?: string; page?: number; limit?: number }) =>
    api.get("/clients", { params }),
  get: (id: string) => api.get(`/clients/${id}`),
  create: (data: Record<string, unknown>) => api.post("/clients", data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/clients/${id}`, data),
  listOnboardingForms: (clientId: string) =>
    api.get(`/clients/${clientId}/onboarding-forms`),
  createLogin: (
    clientId: string,
    data?: { email?: string; phone?: string; password?: string },
  ) => api.post(`/clients/${clientId}/create-login`, data ?? {}),
  assignOnboardingForm: (clientId: string, data: { formId: string; notes?: string }) =>
    api.post(`/clients/${clientId}/onboarding-forms/assign`, data),
  createOnboardingForm: (
    clientId: string,
    data: { title: string; description?: string; publish?: boolean },
  ) => api.post(`/clients/${clientId}/onboarding-forms`, data),
  unassignOnboardingForm: (clientId: string, assignmentId: string) =>
    api.delete(`/clients/${clientId}/onboarding-forms/${assignmentId}`),
  enableSetup: (clientId: string) => api.post(`/clients/${clientId}/setup/enable`),
  updateSetup: (
    clientId: string,
    data: { requireNda?: boolean; ndaTemplateId?: string | null },
  ) => api.post(`/clients/${clientId}/setup`, data),
};

export const setupApi = {
  get: (token: string) => api.get(`/setup/${token}`),
  signNda: (
    token: string,
    data: { signatureType: "DRAW" | "TYPE" | "UPLOAD"; signatureData: string },
  ) => api.post(`/setup/${token}/nda`, data),
};

// Leads API
export const leadsApi = {
  list: (params?: {
    status?: string;
    ownerId?: string;
    source?: string;
    search?: string;
    onBoard?: boolean;
    page?: number;
    limit?: number;
  }) => api.get("/leads", { params }),
  stats: () => api.get("/leads/stats"),
  get: (id: string) => api.get(`/leads/${id}`),
  create: (data: Record<string, unknown>) => api.post("/leads", data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/leads/${id}`, data),
  remove: (id: string) => api.delete(`/leads/${id}`),
  moveToBoard: (ids: string[]) => api.post("/leads/move-to-board", { ids }),
  removeFromBoard: (ids: string[]) => api.post("/leads/remove-from-board", { ids }),
  import: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post("/leads/import", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  addActivity: (id: string, data: { type: string; body: string }) =>
    api.post(`/leads/${id}/activities`, data),
  convert: (id: string, data?: Record<string, unknown>) =>
    api.post(`/leads/${id}/convert`, data ?? {}),
  convertToDeal: (id: string, data?: Record<string, unknown>) =>
    api.post(`/leads/${id}/convert-to-deal`, data ?? {}),
};

// Deals API
export const dealsApi = {
  list: (params?: {
    status?: string;
    clientId?: string;
    leadId?: string;
    page?: number;
    limit?: number;
  }) => api.get("/deals", { params }),
  pipeline: () => api.get("/deals/pipeline"),
  get: (id: string) => api.get(`/deals/${id}`),
  create: (data: Record<string, unknown>) => api.post("/deals", data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/deals/${id}`, data),
  remove: (id: string) => api.delete(`/deals/${id}`),
};

export const contactsApi = {
  list: (params?: { search?: string; organizationId?: string; page?: number; limit?: number }) =>
    api.get("/contacts", { params }),
  get: (id: string) => api.get(`/contacts/${id}`),
  create: (data: Record<string, unknown>) => api.post("/contacts", data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/contacts/${id}`, data),
  remove: (id: string) => api.delete(`/contacts/${id}`),
};

export const organizationsApi = {
  list: (params?: { search?: string; page?: number; limit?: number }) =>
    api.get("/organizations", { params }),
  get: (id: string) => api.get(`/organizations/${id}`),
  create: (data: Record<string, unknown>) => api.post("/organizations", data),
  update: (id: string, data: Record<string, unknown>) =>
    api.patch(`/organizations/${id}`, data),
  remove: (id: string) => api.delete(`/organizations/${id}`),
};

export const crmTasksApi = {
  list: (params?: Record<string, unknown>) => api.get("/crm/tasks", { params }),
  create: (data: Record<string, unknown>) => api.post("/crm/tasks", data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/crm/tasks/${id}`, data),
  remove: (id: string) => api.delete(`/crm/tasks/${id}`),
};

export const crmNotesApi = {
  list: (params?: Record<string, unknown>) => api.get("/crm/notes", { params }),
  create: (data: Record<string, unknown>) => api.post("/crm/notes", data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/crm/notes/${id}`, data),
  remove: (id: string) => api.delete(`/crm/notes/${id}`),
};

export const crmCommsApi = {
  listEmails: (params?: Record<string, unknown>) => api.get("/crm/emails", { params }),
  createEmail: (data: Record<string, unknown>) => api.post("/crm/emails", data),
  listCalls: (params?: Record<string, unknown>) => api.get("/crm/calls", { params }),
  createCall: (data: Record<string, unknown>) => api.post("/crm/calls", data),
  listWhatsApp: (params?: Record<string, unknown>) => api.get("/crm/whatsapp", { params }),
  createWhatsApp: (data: Record<string, unknown>) => api.post("/crm/whatsapp", data),
  listAttachments: (params?: Record<string, unknown>) =>
    api.get("/crm/attachments", { params }),
  createAttachment: (data: Record<string, unknown>) => api.post("/crm/attachments", data),
};

export const integrationsApi = {
  status: () => api.get("/integrations/status"),
};

// Reports API
export const reportsApi = {
  projects: () => api.get("/reports/projects"),
  issues: (projectId?: string) => api.get("/reports/issues", { params: { projectId } }),
  crm: () => api.get("/reports/crm"),
};

// Onboarding API
export const onboardingApi = {
  listForms: () => api.get("/onboarding/forms"),
  getForm: (id: string) => {
    if (!id || id === "new") {
      return Promise.reject(new Error("Invalid form id"));
    }
    return api.get(`/onboarding/forms/${id}`);
  },
  createForm: (data: { title: string; slug?: string; description?: string }) => {
    const title = data.title?.trim() || "Client onboarding form";
    const slug =
      data.slug ||
      `${title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 40)}-${Date.now().toString(36)}`;
    return api.post("/onboarding/forms", { ...data, title, slug });
  },
  updateForm: async (
    id: string,
    data: {
      title?: string;
      description?: string;
      fields?: Record<string, unknown>[];
      publish?: boolean;
    }
  ) => {
    if (!id || id === "new") {
      return Promise.reject(new Error("Create the form before updating"));
    }

    // Prefer bulk PUT (new backend). Fall back to PATCH + POST fields + publish
    // for older Railway deploys that only expose those routes.
    try {
      return await api.put(`/onboarding/forms/${id}`, data);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status !== 404 && status !== 405) throw err;

      if (data.title || data.description !== undefined) {
        await api.patch(`/onboarding/forms/${id}`, {
          title: data.title,
          description: data.description,
        });
      }

      for (const [order, field] of (data.fields ?? []).entries()) {
        await api.post(`/onboarding/forms/${id}/fields`, {
          ...field,
          order: (field as { order?: number }).order ?? order,
        });
      }

      if (data.publish !== false) {
        await api.post(`/onboarding/forms/${id}/publish`);
      }

      return api.get(`/onboarding/forms/${id}`);
    }
  },
  saveFields: (
    id: string,
    data: {
      title?: string;
      description?: string;
      fields: Record<string, unknown>[];
      publish?: boolean;
    }
  ) => onboardingApi.updateForm(id, data),
  publishForm: (id: string) => api.post(`/onboarding/forms/${id}/publish`),
  getPublicForm: (token: string, clientId?: string) =>
    api.get(`/onboarding/public/${token}`, {
      params: clientId ? { clientId } : undefined,
    }),
  submitPublicForm: (
    token: string,
    data: Record<string, unknown>,
    clientId?: string,
  ) => api.post(`/onboarding/public/${token}/submit`, { data, clientId }),
};

// NDA API
export const ndaApi = {
  listTemplates: () => api.get("/nda/templates"),
  listSigned: () => api.get("/nda/signed"),
  getTemplate: (id: string) => api.get(`/nda/templates/${id}`),
  createTemplate: (data: { title: string; content: string; clientId?: string }) =>
    api.post("/nda/templates", data),
  updateTemplate: (
    id: string,
    data: { title?: string; content?: string; isActive?: boolean },
  ) => api.patch(`/nda/templates/${id}`, data),
  preview: (id: string, data?: { clientId?: string; content?: string }) =>
    api.post(`/nda/templates/${id}/preview`, data ?? {}),
  assign: (data: {
    clientId: string;
    templateId?: string;
    customContent?: string;
    customTitle?: string;
  }) => api.post("/nda/assign", data),
  sign: (
    templateId: string,
    data: {
      signatureType: "DRAW" | "TYPE" | "UPLOAD";
      signatureData: string;
      clientId?: string;
    },
  ) => api.post(`/nda/templates/${templateId}/sign`, data),
};

// Documents API
export const documentsApi = {
  list: (params?: { folderId?: string; projectId?: string }) =>
    api.get("/documents", { params }),
  folders: (params?: { parentId?: string }) =>
    api.get("/documents/folders", { params }),
  upload: (
    file: File,
    meta?: {
      name?: string;
      clientId?: string;
      projectId?: string;
      isClientVisible?: boolean;
    },
  ) => {
    const formData = new FormData();
    formData.append("file", file);
    if (meta?.name) formData.append("name", meta.name);
    if (meta?.clientId) formData.append("clientId", meta.clientId);
    if (meta?.projectId) formData.append("projectId", meta.projectId);
    if (meta?.isClientVisible !== undefined) {
      formData.append("isClientVisible", String(meta.isClientVisible));
    }
    return api.post("/documents/upload", formData, {
      timeout: 120000,
    });
  },
  update: (id: string, data: Record<string, unknown>) =>
    api.patch(`/documents/${id}`, data),
  get: (id: string) => api.get(`/documents/${id}`),
  download: (id: string) => api.get(`/documents/${id}/download`, { timeout: 120000 }),
  remove: (id: string) => api.delete(`/documents/${id}`),
};

// Invoices API
export const invoicesApi = {
  list: (params?: Record<string, unknown>) => api.get("/invoices", { params }),
  get: (id: string) => api.get(`/invoices/${id}`),
  nextNumber: () => api.get("/invoices/next-number"),
  create: (data: Record<string, unknown>) => api.post("/invoices", data),
  createWithPdf: (data: {
    clientId: string;
    billingType: string;
    number?: string;
    projectId?: string;
    milestoneId?: string;
    title?: string;
    currency?: string;
    dueDate?: string;
    notes?: string;
    amount?: number;
    items?: unknown[];
    file?: File;
  }) => {
    const formData = new FormData();
    formData.append("clientId", data.clientId);
    formData.append("billingType", data.billingType);
    if (data.number) formData.append("number", data.number);
    if (data.projectId) formData.append("projectId", data.projectId);
    if (data.milestoneId) formData.append("milestoneId", data.milestoneId);
    if (data.title) formData.append("title", data.title);
    if (data.currency) formData.append("currency", data.currency);
    if (data.dueDate) formData.append("dueDate", data.dueDate);
    if (data.notes) formData.append("notes", data.notes);
    if (data.amount != null) formData.append("amount", String(data.amount));
    if (data.items) formData.append("items", JSON.stringify(data.items));
    if (data.file) formData.append("file", data.file);
    return api.post("/invoices/with-pdf", formData, {
      headers: { "Content-Type": undefined as unknown as string },
      timeout: 120000,
      transformRequest: [
        (body, headers) => {
          if (headers && typeof headers === "object") {
            delete (headers as Record<string, unknown>)["Content-Type"];
          }
          return body;
        },
      ],
    });
  },
  update: (id: string, data: Record<string, unknown>) =>
    api.patch(`/invoices/${id}`, data),
  send: (id: string) => api.post(`/invoices/${id}/send`),
  markPaid: (id: string) => api.post(`/invoices/${id}/mark-paid`),
  generatePdf: (id: string) => api.post(`/invoices/${id}/generate-pdf`),
  downloadPdf: async (id: string, filename?: string) => {
    const res = await api.get(`/invoices/${id}/download`, {
      responseType: "blob",
      timeout: 120000,
    });
    const blob = new Blob([res.data], { type: "application/pdf" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || `invoice-${id}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    return res;
  },
  uploadPdf: (id: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post(`/invoices/${id}/pdf`, formData, {
      headers: { "Content-Type": undefined as unknown as string },
      timeout: 120000,
      transformRequest: [
        (body, headers) => {
          if (headers && typeof headers === "object") {
            delete (headers as Record<string, unknown>)["Content-Type"];
          }
          return body;
        },
      ],
    });
  },
  remove: (id: string) => api.delete(`/invoices/${id}`),
};

// Team API
export const teamApi = {
  list: () => api.get("/team"),
  invite: (email: string, role: string) =>
    api.post("/team/invite", { email, role }),
};

// Dashboard API ΓÇö prefers dedicated endpoints, falls back to /overview
// (older Railway deploys only expose overview)
function mapOverviewToStatsPayload(overview: Record<string, unknown>) {
  const rawStats = (overview.stats ?? {}) as Record<string, unknown>;
  const activeProjects = String(rawStats.activeProjects ?? rawStats.totalProjects ?? 0);
  const openTasks = String(rawStats.openIssues ?? rawStats.totalIssues ?? 0);
  const data = [
    { label: "Active Projects", value: activeProjects },
    { label: "Open Tasks", value: openTasks },
    { label: "Open Bugs", value: "0" },
    { label: "Avg. Velocity", value: "0" },
  ];

  const issuesByStatus = Array.isArray(overview.issuesByStatus)
    ? (overview.issuesByStatus as { status: string; count: number }[])
    : [];
  const colors: Record<string, string> = {
    TODO: "#64748b",
    IN_PROGRESS: "#a1c8cf",
    DONE: "#10b981",
  };
  const distribution = issuesByStatus.map((g) => ({
    name: g.status,
    value: g.count,
    color: colors[g.status] ?? "#64748b",
  }));

  const recent = Array.isArray(overview.recentActivity)
    ? (overview.recentActivity as Record<string, unknown>[])
    : Array.isArray(overview.data)
      ? (overview.data as Record<string, unknown>[])
      : [];

  return {
    data,
    velocity: Array.isArray(overview.velocity) ? overview.velocity : [],
    distribution: Array.isArray(overview.distribution) ? overview.distribution : distribution,
    activity: recent.map((row, i) => {
      if (row.action && row.user && row.time) return row;
      const user = row.user as { firstName?: string; lastName?: string } | string | undefined;
      const userName =
        typeof user === "string"
          ? user
          : user
            ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || "System"
            : "System";
      return {
        id: String(row.id ?? i),
        action: String(row.action ?? row.message ?? "updated"),
        target: String(row.target ?? row.message ?? row.entityType ?? "item"),
        user: userName,
        time: String(row.time ?? row.createdAt ?? new Date().toISOString()),
      };
    }),
  };
}

export const dashboardApi = {
  overview: () => api.get("/dashboard/overview"),
  stats: async () => {
    try {
      return await api.get("/dashboard/stats");
    } catch {
      const res = await api.get("/dashboard/overview");
      const body = res.data?.data ?? res.data;
      return { ...res, data: mapOverviewToStatsPayload(body ?? {}) };
    }
  },
  activity: async () => {
    try {
      return await api.get("/dashboard/activity");
    } catch {
      const res = await api.get("/dashboard/overview");
      const body = res.data?.data ?? res.data;
      const mapped = mapOverviewToStatsPayload(body ?? {});
      return { ...res, data: mapped.activity };
    }
  },
};

// Notifications API
export const notificationsApi = {
  list: () => api.get("/notifications"),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch("/notifications/read-all"),
};

export default api;
