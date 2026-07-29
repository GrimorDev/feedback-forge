import type { Category, Feedback, Integration, Project, Source, Status } from "../types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

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

export type ProjectSettingsResponse = {
  project: Project;
  integrations: Integration[];
  instructions: {
    apiBaseUrl: string;
    discordProjectEndpoint: string;
    discordWebhookUrl: string;
    githubWebhookUrl: string;
    widgetSnippet: string;
  };
};

export async function fetchSession() {
  return apiFetch<SessionResponse>("/api/v1/auth/me");
}

export async function fetchPublicBoard(projectSlug: string) {
  return apiFetch<BoardResponse>(`/api/v1/projects/${projectSlug}/board`);
}

export async function fetchChangelog(projectSlug: string) {
  return apiFetch<BoardResponse>(`/api/v1/projects/${projectSlug}/changelog`);
}

export async function fetchAdminFeedbacks(projectSlug: string, adminKey?: string, query?: { status?: Status | "ALL"; q?: string }) {
  const params = new URLSearchParams({ projectSlug, take: "100" });
  if (query?.status && query.status !== "ALL") params.set("status", query.status);
  if (query?.q) params.set("q", query.q);
  return apiFetch<{ feedbacks: Feedback[] }>(`/api/v1/admin/feedbacks?${params.toString()}`, {}, { adminKey });
}

export async function fetchProjectSettings(projectSlug: string, adminKey?: string) {
  return apiFetch<ProjectSettingsResponse>(`/api/v1/admin/projects/${projectSlug}/settings`, {}, { adminKey });
}

export async function updateProjectSettings(
  projectSlug: string,
  input: Partial<Pick<Project, "name" | "description" | "customDomain" | "publicRoadmap" | "requireLoginToVote" | "moderatorDiscordIds">>,
  adminKey?: string
) {
  return apiFetch<{ project: Project }>(
    `/api/v1/admin/projects/${projectSlug}/settings`,
    { method: "PATCH", body: JSON.stringify(input) },
    { adminKey }
  );
}

export async function updateIntegration(projectSlug: string, provider: Source, input: { enabled: boolean; config: Record<string, unknown> }, adminKey?: string) {
  return apiFetch<{ integration: Integration }>(
    `/api/v1/admin/projects/${projectSlug}/integrations/${provider}`,
    { method: "PUT", body: JSON.stringify(input) },
    { adminKey }
  );
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
  projectSlug: string;
  title: string;
  description: string;
  category: Category;
  source: Source;
}) {
  const { projectSlug, ...payload } = input;
  return apiFetch<{ feedback: Feedback }>(`/api/v1/projects/${projectSlug}/feedback`, {
    method: "POST",
    body: JSON.stringify({
      ...payload,
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
