export type Role = "ADMIN" | "MEMBER";
export type Category = "BUG" | "FEATURE" | "IMPROVEMENT";
export type Status =
  | "TRIAGE"
  | "UNDER_REVIEW"
  | "PLANNED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "REJECTED";
export type Source = "WEB_WIDGET" | "DISCORD" | "GITHUB" | "API";

export type User = {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  discordId?: string;
  role: Role;
  stripeCustomerId?: string;
  plan: "EARLY_ADOPTER" | "PRO" | "FREE";
  lifetimeFree: boolean;
};

export type Project = {
  id: string;
  name: string;
  slug: string;
  description: string;
  customDomain?: string;
  publicRoadmap?: boolean;
  requireLoginToVote?: boolean;
  requireDiscordAuth?: boolean;
  discordGuildId?: string;
  discordRoleId?: string;
  moderatorDiscordIds?: string[];
  ownerId: string;
  createdAt?: string;
  updatedAt?: string;
};

export type Integration = {
  id: string;
  provider: Source;
  config: Record<string, unknown>;
  enabled: boolean;
  projectId: string;
  createdAt: string;
  updatedAt: string;
};

export type Feedback = {
  id: string;
  projectId: string;
  authorId: string;
  title: string;
  description: string;
  status: Status;
  category: Category;
  source: Source;
  tags: string[];
  priority: number;
  upvotesCount: number;
  mergedIntoId?: string;
  createdAt: string;
  updatedAt: string;
};

export type Comment = {
  id: string;
  feedbackId: string;
  authorId: string;
  content: string;
  isInternal: boolean;
  createdAt: string;
};

export type NotificationEvent = {
  id: string;
  feedbackId: string;
  channel: "EMAIL" | "DISCORD";
  recipient: string;
  message: string;
  createdAt: string;
};

export type AppState = {
  users: User[];
  projects: Project[];
  feedbacks: Feedback[];
  votes: Record<string, string[]>;
  comments: Comment[];
  notifications: NotificationEvent[];
  activeProjectSlug: string;
};
