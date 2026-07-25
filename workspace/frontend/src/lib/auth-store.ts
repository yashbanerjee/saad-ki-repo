import { create } from "zustand";
import { persist } from "zustand/middleware";

export type UserRole = "admin" | "manager" | "member" | "client";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  companyId?: string;
  companyName?: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  setTokens: (accessToken: string, refreshToken?: string) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      setAuth: (user, accessToken, refreshToken) =>
        set({ user, accessToken, refreshToken, isAuthenticated: true }),
      setTokens: (accessToken, refreshToken) =>
        set((state) => ({
          accessToken,
          refreshToken: refreshToken ?? state.refreshToken,
        })),
      logout: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        }),
      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),
    }),
    {
      name: "taskflow-auth",
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

export function hasRole(user: User | null, roles: UserRole[]) {
  if (!user) return false;
  return roles.includes(user.role);
}

/** Map API login/me/register user payload into the frontend User shape. */
export function normalizeAuthUser(
  raw: Record<string, unknown>,
  companyNameFallback?: string
): User {
  const roleSlugs = Array.isArray(raw.roles)
    ? (raw.roles as unknown[])
        .map((r) => {
          if (typeof r === "string") return r;
          if (r && typeof r === "object") {
            const obj = r as { slug?: string; role?: { slug?: string } };
            return obj.role?.slug ?? obj.slug;
          }
          return undefined;
        })
        .filter((s): s is string => Boolean(s))
    : [];

  let role: UserRole =
    raw.role === "admin" ||
    raw.role === "manager" ||
    raw.role === "member" ||
    raw.role === "client"
      ? raw.role
      : "member";

  if (roleSlugs.includes("super_admin") || roleSlugs.includes("company_admin")) {
    role = "admin";
  } else if (roleSlugs.includes("project_manager") || roleSlugs.includes("team_lead")) {
    role = "manager";
  } else if (roleSlugs.includes("client")) {
    role = "client";
  }

  const firstName = typeof raw.firstName === "string" ? raw.firstName : "";
  const lastName = typeof raw.lastName === "string" ? raw.lastName : "";
  const name =
    (typeof raw.name === "string" && raw.name.trim()) ||
    `${firstName} ${lastName}`.trim() ||
    (typeof raw.email === "string" ? raw.email : "User");

  const company =
    raw.company && typeof raw.company === "object"
      ? (raw.company as { name?: string })
      : null;

  return {
    id: String(raw.id ?? ""),
    email: String(raw.email ?? ""),
    name,
    role,
    avatar: typeof raw.avatar === "string" ? raw.avatar : undefined,
    companyId:
      typeof raw.companyId === "string"
        ? raw.companyId
        : raw.companyId == null
          ? undefined
          : String(raw.companyId),
    companyName:
      (typeof raw.companyName === "string" && raw.companyName) ||
      company?.name ||
      companyNameFallback ||
      undefined,
  };
}
