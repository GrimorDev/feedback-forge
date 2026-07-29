import type { Category, Feedback, Project, Source, Status } from "../types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";
const PROJECT_SLUG = import.meta.env.VITE_PROJECT_SLUG ?? "orbit-chat";

type ApiOptions = {
  adminKey?: string;
};

async function apiFetch<T>(path: string, init: RequestInit = {}, options: ApiOptions = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  if (options.adminKey) {
    headers.set("x-admin-api-key", options.adminKey);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: "include"
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error ?? `Request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export type SessionResponse = {
  user: {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
    discordId: string | null;
    role: "ADMIN" | "MEMBER";
  } | null;
  isAdmin: boolean;
  discordOAuthConfigured: boolean;
};

export type BoardResponse = {
  project: Project;
  feedbacks: Feedback[];
};

export async function fetchSession() {
  return apiFetch<SessionResponse>("/api/v1/auth/me");
}

export async function fetchPublicBoard() {
  return apiFetch<BoardResponse>(`/api/v1/projects/${PROJECT_SLUG}/board`);
}

export async function fetchChangelog() {
  return apiFetch<BoardResponse>(`/api/v1/projects/${PROJECT_SLUG}/changelog`);
}

export async function fetchAdminFeedbacks(adminKey?: string, query?: { status?: Status | "ALL"; q?: string }) {
  const params = new URLSearchParams({ projectSlug: PROJECT_SLUG, take: "100" });
  if (query?.status && query.status !== "ALL") params.set("status", query.status);
  if (query?.q) params.set("q", query.q);
  return apiFetch<{ feedbacks: Feedback[] }>(`/api/v1/admin/feedbacks?${params.toString()}`, {}, { adminKey });
}

export async function updateAdminFeedback(id: string, patch: Partial<Pick<Feedback, "status" | "priority" | "category" | "tags">>, adminKey?: string) {
  return apiFetch<{ feedback: Feedback }>(
    `/api/v1/admin/feedbacks/${id}`,
    { method: "PATCH", body: JSON.stringify(patch) },
    { adminKey }
  );
}

export async function mergeFeedback(targetId: string, duplicateId: string, adminKey?: string) {
  return apiFetch<{ target: Feedback; duplicate: Feedback }>(
    `/api/v1/admin/feedbacks/${targetId}/merge`,
    { method: "POST", body: JSON.stringify({ duplicateId }) },
    { adminKey }
  );
}

export async function createPublicFeedback(input: {
  title: string;
  description: string;
  category: Category;
  source: Source;
}) {
  return apiFetch<{ feedback: Feedback }>(`/api/v1/projects/${PROJECT_SLUG}/feedback`, {
    method: "POST",
    body: JSON.stringify({
      ...input,
      name: "Community member",
      email: `visitor-${crypto.randomUUID()}@feedback.local`
    })
  });
}

export async function voteFeedback(id: string) {
  return apiFetch<{ feedback: Feedback; voted: boolean }>(`/api/v1/feedback/${id}/vote`, {
    method: "POST",
    body: JSON.stringify({
      name: "Community member",
      email: `visitor-${crypto.randomUUID()}@feedback.local`
    })
  });
}

export function discordLoginUrl() {
  return `${API_BASE_URL}/api/v1/auth/discord/start`;
}

export async function logout() {
  return apiFetch<{ ok: boolean }>("/api/v1/auth/logout", { method: "POST" });
}
