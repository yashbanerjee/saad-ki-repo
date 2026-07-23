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
    name: string;
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
  list: () => api.get("/clients"),
  get: (id: string) => api.get(`/clients/${id}`),
  create: (data: Record<string, unknown>) => api.post("/clients", data),
};

// Onboarding API
export const onboardingApi = {
  listForms: () => api.get("/onboarding/forms"),
  getForm: (id: string) => api.get(`/onboarding/forms/${id}`),
  createForm: (data: Record<string, unknown>) =>
    api.post("/onboarding/forms", data),
  updateForm: (id: string, data: Record<string, unknown>) =>
    api.put(`/onboarding/forms/${id}`, data),
  getPublicForm: (token: string) =>
    api.get(`/onboarding/public/${token}`),
  submitPublicForm: (token: string, data: Record<string, unknown>) =>
    api.post(`/onboarding/public/${token}/submit`, data),
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

// Dashboard API
export const dashboardApi = {
  stats: () => api.get("/dashboard/stats"),
  activity: () => api.get("/dashboard/activity"),
};

// Notifications API
export const notificationsApi = {
  list: () => api.get("/notifications"),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch("/notifications/read-all"),
};

export default api;
