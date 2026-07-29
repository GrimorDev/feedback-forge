import { seedState } from "../data/seed";
import type { AppState, Category, Feedback, Status } from "../types";

const STORAGE_KEY = "feedback-forge-state-v1";

export const statusLabels: Record<Status, string> = {
  TRIAGE: "Triage",
  UNDER_REVIEW: "Analizowane",
  PLANNED: "Planowane",
  IN_PROGRESS: "W trakcie",
  COMPLETED: "Wdrożone",
  REJECTED: "Odrzucone"
};

export const categoryLabels: Record<Category, string> = {
  BUG: "Bug",
  FEATURE: "Feature",
  IMPROVEMENT: "Performance"
};

export const roadmapStatuses: Status[] = ["PLANNED", "IN_PROGRESS", "COMPLETED"];
export const adminStatuses: Status[] = [
  "TRIAGE",
  "UNDER_REVIEW",
  "PLANNED",
  "IN_PROGRESS",
  "COMPLETED",
  "REJECTED"
];

export function loadState(): AppState {
  const cached = localStorage.getItem(STORAGE_KEY);
  if (!cached) return seedState;

  try {
    return JSON.parse(cached) as AppState;
  } catch {
    return seedState;
  }
}

export function persistState(state: AppState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function createFeedback(input: Pick<Feedback, "title" | "description" | "category" | "source">): Feedback {
  return {
    id: `f_${crypto.randomUUID()}`,
    projectId: "p_orbit",
    authorId: "u_mila",
    status: "TRIAGE",
    tags: [],
    priority: 2,
    upvotesCount: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...input
  };
}

export function compactDate(value: string) {
  return new Intl.DateTimeFormat("pl", {
    day: "2-digit",
    month: "short"
  }).format(new Date(value));
}
