import type { AppState } from "../types";

const now = new Date();
const daysAgo = (days: number) =>
  new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

export const seedState: AppState = {
  activeProjectSlug: "orbit-chat",
  users: [
    {
      id: "u_admin",
      email: "founder@orbit.chat",
      name: "Klaudia",
      role: "ADMIN",
      plan: "EARLY_ADOPTER",
      lifetimeFree: true,
      stripeCustomerId: "cus_early_001"
    },
    {
      id: "u_mila",
      email: "mila@example.com",
      name: "Mila",
      discordId: "71820491",
      role: "MEMBER",
      plan: "FREE",
      lifetimeFree: false
    },
    {
      id: "u_arek",
      email: "arek@example.com",
      name: "Arek",
      role: "MEMBER",
      plan: "FREE",
      lifetimeFree: false
    }
  ],
  projects: [
    {
      id: "p_orbit",
      name: "Orbit Chat",
      slug: "orbit-chat",
      description: "Lekka społeczność dla zamkniętych grup, modderów i twórców.",
      ownerId: "u_admin"
    }
  ],
  feedbacks: [
    {
      id: "f_1",
      projectId: "p_orbit",
      authorId: "u_mila",
      title: "Kanały tylko dla patronów z automatyczną rolą",
      description:
        "Po opłaceniu dostępu użytkownik powinien dostać rolę i widzieć paczki dodatków bez ręcznej moderacji.",
      status: "PLANNED",
      category: "FEATURE",
      source: "DISCORD",
      tags: ["monetyzacja", "role"],
      priority: 4,
      upvotesCount: 42,
      createdAt: daysAgo(14),
      updatedAt: daysAgo(2)
    },
    {
      id: "f_2",
      projectId: "p_orbit",
      authorId: "u_arek",
      title: "Tryb offline dla listy zadań społeczności",
      description:
        "Dashboard powinien otwierać się natychmiast, nawet gdy jadę pociągiem i sieć znika.",
      status: "IN_PROGRESS",
      category: "IMPROVEMENT",
      source: "WEB_WIDGET",
      tags: ["offline-first", "wydajność"],
      priority: 5,
      upvotesCount: 37,
      createdAt: daysAgo(9),
      updatedAt: daysAgo(1)
    },
    {
      id: "f_3",
      projectId: "p_orbit",
      authorId: "u_mila",
      title: "Powiadomienie po wdrożeniu sugestii",
      description:
        "Chcę dostać DM na Discordzie, gdy moja sugestia faktycznie trafi do produktu.",
      status: "TRIAGE",
      category: "FEATURE",
      source: "DISCORD",
      tags: ["feedback-loop"],
      priority: 3,
      upvotesCount: 18,
      createdAt: daysAgo(5),
      updatedAt: daysAgo(5)
    },
    {
      id: "f_4",
      projectId: "p_orbit",
      authorId: "u_arek",
      title: "Import issue z GitHuba jako zgłoszeń",
      description:
        "Repo ma już dużo issue. Dobrze byłoby je podciągnąć i połączyć z głosami społeczności.",
      status: "UNDER_REVIEW",
      category: "FEATURE",
      source: "GITHUB",
      tags: ["github", "import"],
      priority: 2,
      upvotesCount: 12,
      createdAt: daysAgo(3),
      updatedAt: daysAgo(3)
    },
    {
      id: "f_5",
      projectId: "p_orbit",
      authorId: "u_mila",
      title: "Duplikaty sugestii z różnych kanałów",
      description:
        "Ten sam pomysł wpada przez mail, Discord i formularz. Przyda się scalanie bez utraty głosów.",
      status: "TRIAGE",
      category: "BUG",
      source: "API",
      tags: ["triage"],
      priority: 5,
      upvotesCount: 29,
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1)
    }
  ],
  votes: {
    f_1: ["u_mila", "u_arek"],
    f_2: ["u_mila"],
    f_3: ["u_arek"],
    f_4: ["u_mila"],
    f_5: ["u_mila", "u_arek"]
  },
  comments: [
    {
      id: "c_1",
      feedbackId: "f_2",
      authorId: "u_admin",
      content: "Wchodzimy w local-first cache i kolejkę synchronizacji.",
      isInternal: false,
      createdAt: daysAgo(1)
    },
    {
      id: "c_2",
      feedbackId: "f_5",
      authorId: "u_admin",
      content: "Dobre do testu heurystyki podobieństwa tytułów.",
      isInternal: true,
      createdAt: daysAgo(1)
    }
  ],
  notifications: []
};
