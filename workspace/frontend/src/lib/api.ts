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

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
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
        useAuthStore.getState().logout();
        isRefreshing = false;
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(`${API_URL}/auth/refresh`, {
          refreshToken,
        });
        const newAccessToken = data.accessToken ?? data.data?.accessToken;
        const newRefreshToken = data.refreshToken ?? data.data?.refreshToken;

        useAuthStore.getState().setTokens(newAccessToken, newRefreshToken);
        processQueue(null, newAccessToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        useAuthStore.getState().logout();
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
  login: (email: string, password: string) =>
    api.post("/auth/login", { email, password }),
  register: (data: {
    companyName: string;
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  }) => api.post("/auth/register", data),
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
  get: (id: string) => api.get(`/projects/${id}`),
  create: (data: Record<string, unknown>) => api.post("/projects", data),
  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/projects/${id}`, data),
  delete: (id: string) => api.delete(`/projects/${id}`),
  getBoard: (id: string) => api.get(`/projects/${id}/board`),
  updateTaskStatus: (projectId: string, taskId: string, status: string) =>
    api.patch(`/projects/${projectId}/tasks/${taskId}`, { status }),
};

// Issues API
export const issuesApi = {
  list: (params?: Record<string, unknown>) =>
    api.get("/issues", { params }),
  get: (id: string) => api.get(`/issues/${id}`),
  create: (data: Record<string, unknown>) => api.post("/issues", data),
  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/issues/${id}`, data),
  addComment: (id: string, content: string) =>
    api.post(`/issues/${id}/comments`, { content }),
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
  assignOnboardingForm: (clientId: string, data: { formId: string; notes?: string }) =>
    api.post(`/clients/${clientId}/onboarding-forms/assign`, data),
  createOnboardingForm: (
    clientId: string,
    data: { title: string; description?: string; publish?: boolean },
  ) => api.post(`/clients/${clientId}/onboarding-forms`, data),
  unassignOnboardingForm: (clientId: string, assignmentId: string) =>
    api.delete(`/clients/${clientId}/onboarding-forms/${assignmentId}`),
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
  getPublicForm: (token: string) => api.get(`/onboarding/public/${token}`),
  submitPublicForm: (
    token: string,
    data: Record<string, unknown>,
    clientId?: string,
  ) => api.post(`/onboarding/public/${token}/submit`, { data, clientId }),
};

// NDA API
export const ndaApi = {
  listTemplates: () => api.get("/nda/templates"),
  sign: (data: Record<string, unknown>) => api.post("/nda/sign", data),
};

// Team API
export const teamApi = {
  list: () => api.get("/team"),
  invite: (email: string, role: string) =>
    api.post("/team/invite", { email, role }),
};

// Dashboard API — prefers dedicated endpoints, falls back to /overview
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
