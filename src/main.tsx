import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Bell,
  Check,
  ChevronUp,
  GitBranch,
  Inbox,
  KanbanSquare,
  Link2,
  Merge,
  Moon,
  Plus,
  RadioTower,
  Rocket,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  Tag,
  Webhook
} from "lucide-react";
import "./styles.css";
import type { AppState, Category, Feedback, Source, Status } from "./types";
import {
  adminStatuses,
  categoryLabels,
  compactDate,
  createFeedback,
  loadState,
  persistState,
  roadmapStatuses,
  statusLabels
} from "./lib/store";

const ENABLE_PAYMENTS = import.meta.env.VITE_ENABLE_PAYMENTS === "true";

function App() {
  const [state, setState] = useState<AppState>(() => loadState());
  const [view, setView] = useState<"portal" | "admin">("admin");
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [query, setQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<Status | "ALL">("ALL");

  useEffect(() => persistState(state), [state]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const project = state.projects.find((item) => item.slug === state.activeProjectSlug)!;
  const visibleFeedbacks = useMemo(() => {
    return state.feedbacks
      .filter((item) => item.projectId === project.id && !item.mergedIntoId)
      .filter((item) => selectedStatus === "ALL" || item.status === selectedStatus)
      .filter((item) => {
        const haystack = `${item.title} ${item.description} ${item.tags.join(" ")}`.toLowerCase();
        return haystack.includes(query.toLowerCase());
      })
      .sort((a, b) => b.priority - a.priority || b.upvotesCount - a.upvotesCount);
  }, [project.id, query, selectedStatus, state.feedbacks]);

  const updateFeedback = (id: string, patch: Partial<Feedback>) => {
    setState((current) => {
      const before = current.feedbacks.find((item) => item.id === id);
      const feedbacks = current.feedbacks.map((item) =>
        item.id === id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item
      );
      const completedNow = before?.status !== "COMPLETED" && patch.status === "COMPLETED";
      const author = before ? current.users.find((user) => user.id === before.authorId) : undefined;
      const notifications =
        completedNow && before && author
          ? [
              {
                id: `n_${crypto.randomUUID()}`,
                feedbackId: id,
                channel: author.discordId ? ("DISCORD" as const) : ("EMAIL" as const),
                recipient: author.discordId ? `discord:${author.discordId}` : author.email,
                message: `Sugestia "${before.title}" została wdrożona.`,
                createdAt: new Date().toISOString()
              },
              ...current.notifications
            ]
          : current.notifications;

      return { ...current, feedbacks, notifications };
    });
  };

  const vote = (id: string) => {
    setState((current) => {
      const userId = "u_mila";
      const voters = current.votes[id] ?? [];
      const hasVote = voters.includes(userId);
      const nextVoters = hasVote ? voters.filter((item) => item !== userId) : [...voters, userId];
      return {
        ...current,
        votes: { ...current.votes, [id]: nextVoters },
        feedbacks: current.feedbacks.map((item) =>
          item.id === id ? { ...item, upvotesCount: Math.max(0, item.upvotesCount + (hasVote ? -1 : 1)) } : item
        )
      };
    });
  };

  const addFeedback = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const feedback = createFeedback({
      title: String(data.get("title") ?? ""),
      description: String(data.get("description") ?? ""),
      category: String(data.get("category") ?? "FEATURE") as Category,
      source: String(data.get("source") ?? "WEB_WIDGET") as Source
    });
    setState((current) => ({
      ...current,
      feedbacks: [feedback, ...current.feedbacks],
      votes: { ...current.votes, [feedback.id]: ["u_mila"] }
    }));
    event.currentTarget.reset();
  };

  const mergeTopDuplicate = (target: Feedback) => {
    const duplicate = state.feedbacks.find(
      (item) => item.id !== target.id && item.status === "TRIAGE" && item.category === target.category && !item.mergedIntoId
    );
    if (!duplicate) return;

    setState((current) => {
      const movedVotes = new Set([...(current.votes[target.id] ?? []), ...(current.votes[duplicate.id] ?? [])]);
      return {
        ...current,
        votes: { ...current.votes, [target.id]: Array.from(movedVotes), [duplicate.id]: [] },
        feedbacks: current.feedbacks.map((item) => {
          if (item.id === target.id) return { ...item, upvotesCount: movedVotes.size, updatedAt: new Date().toISOString() };
          if (item.id === duplicate.id) return { ...item, mergedIntoId: target.id, status: "REJECTED" };
          return item;
        })
      };
    });
  };

  return (
    <main className="shell">
      <Header projectName={project.name} view={view} setView={setView} theme={theme} setTheme={setTheme} />
      <section className="workspace">
        <div className="primaryPane">
          {view === "admin" ? (
            <>
              <AdminToolbar
                query={query}
                setQuery={setQuery}
                selectedStatus={selectedStatus}
                setSelectedStatus={setSelectedStatus}
              />
              <AdminBoard feedbacks={visibleFeedbacks} updateFeedback={updateFeedback} mergeTopDuplicate={mergeTopDuplicate} />
            </>
          ) : (
            <Portal
              projectDescription={project.description}
              feedbacks={visibleFeedbacks}
              addFeedback={addFeedback}
              vote={vote}
              notifications={state.notifications}
            />
          )}
        </div>
        <Aside state={state} enablePayments={ENABLE_PAYMENTS} />
      </section>
    </main>
  );
}

function Header({
  projectName,
  view,
  setView,
  theme,
  setTheme
}: {
  projectName: string;
  view: "portal" | "admin";
  setView: (view: "portal" | "admin") => void;
  theme: "light" | "dark";
  setTheme: (theme: "light" | "dark") => void;
}) {
  return (
    <header className="topbar">
      <div className="brand">
        <Rocket size={24} />
        <div>
          <strong>{projectName}</strong>
          <span>Feedback Forge</span>
        </div>
      </div>
      <div className="headerActions">
        <nav className="segmented" aria-label="Widok aplikacji">
          <button className={view === "admin" ? "active" : ""} onClick={() => setView("admin")}>
            <KanbanSquare size={16} /> Panel
          </button>
          <button className={view === "portal" ? "active" : ""} onClick={() => setView("portal")}>
            <RadioTower size={16} /> Roadmapa
          </button>
        </nav>
        <button
          className="themeToggle"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          title={theme === "dark" ? "Jasny motyw" : "Ciemny motyw"}
        >
          {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
        </button>
      </div>
    </header>
  );
}

function AdminToolbar({
  query,
  setQuery,
  selectedStatus,
  setSelectedStatus
}: {
  query: string;
  setQuery: (value: string) => void;
  selectedStatus: Status | "ALL";
  setSelectedStatus: (status: Status | "ALL") => void;
}) {
  return (
    <div className="toolbar">
      <label className="search">
        <Search size={17} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Szukaj po tytule, tagu lub opisie" />
      </label>
      <select value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value as Status | "ALL")}>
        <option value="ALL">Wszystkie statusy</option>
        {adminStatuses.map((status) => (
          <option key={status} value={status}>
            {statusLabels[status]}
          </option>
        ))}
      </select>
    </div>
  );
}

function AdminBoard({
  feedbacks,
  updateFeedback,
  mergeTopDuplicate
}: {
  feedbacks: Feedback[];
  updateFeedback: (id: string, patch: Partial<Feedback>) => void;
  mergeTopDuplicate: (target: Feedback) => void;
}) {
  return (
    <section className="kanban" aria-label="Tablica triage">
      {adminStatuses.map((status) => (
        <div className="lane" key={status}>
          <div className="laneHeader">
            <span>{statusLabels[status]}</span>
            <b>{feedbacks.filter((item) => item.status === status).length}</b>
          </div>
          <div className="laneStack">
            {feedbacks.filter((item) => item.status === status).length === 0 ? (
              <div className="emptyLane">Brak zgłoszeń</div>
            ) : (
              feedbacks
                .filter((item) => item.status === status)
                .map((item) => (
                  <FeedbackCard
                    key={item.id}
                    feedback={item}
                    onStatus={(next) => updateFeedback(item.id, { status: next })}
                    onPriority={(priority) => updateFeedback(item.id, { priority })}
                    onMerge={() => mergeTopDuplicate(item)}
                  />
                ))
            )}
          </div>
        </div>
      ))}
    </section>
  );
}

function FeedbackCard({
  feedback,
  onStatus,
  onPriority,
  onMerge
}: {
  feedback: Feedback;
  onStatus: (status: Status) => void;
  onPriority: (priority: number) => void;
  onMerge: () => void;
}) {
  return (
    <article className="feedbackCard">
      <div className="cardMeta">
        <span className={`source source-${feedback.source.toLowerCase()}`}>{feedback.source.replace("_", " ")}</span>
        <span>{compactDate(feedback.createdAt)}</span>
      </div>
      <h3>{feedback.title}</h3>
      <p>{feedback.description}</p>
      <div className="chips">
        <span><Tag size={13} /> {categoryLabels[feedback.category]}</span>
        {feedback.tags.slice(0, 2).map((tag) => (
          <span key={tag}>#{tag}</span>
        ))}
      </div>
      <div className="cardActions">
        <span className="votes"><ChevronUp size={15} /> {feedback.upvotesCount}</span>
        <input
          aria-label="Priorytet"
          type="range"
          min="1"
          max="5"
          value={feedback.priority}
          onChange={(event) => onPriority(Number(event.target.value))}
        />
        <select value={feedback.status} onChange={(event) => onStatus(event.target.value as Status)}>
          {adminStatuses.map((status) => (
            <option key={status} value={status}>
              {statusLabels[status]}
            </option>
          ))}
        </select>
        <button className="iconButton" onClick={onMerge} title="Scal podobne zgłoszenie">
          <Merge size={16} />
        </button>
      </div>
    </article>
  );
}

function Portal({
  projectDescription,
  feedbacks,
  addFeedback,
  vote,
  notifications
}: {
  projectDescription: string;
  feedbacks: Feedback[];
  addFeedback: (event: React.FormEvent<HTMLFormElement>) => void;
  vote: (id: string) => void;
  notifications: AppState["notifications"];
}) {
  const roadmap = feedbacks.filter((item) => roadmapStatuses.includes(item.status));
  const completed = feedbacks.filter((item) => item.status === "COMPLETED");

  return (
    <section className="portal">
      <div className="portalIntro">
        <div>
          <h1>Publiczna roadmapa</h1>
          <p>{projectDescription}</p>
        </div>
        <div className="metrics">
          <span><Inbox size={18} /> {feedbacks.length} zgłoszeń</span>
          <span><Check size={18} /> {completed.length} wdrożone</span>
          <span><Bell size={18} /> {notifications.length} powiadomień</span>
        </div>
      </div>
      <form className="submitBox" onSubmit={addFeedback}>
        <input name="title" required minLength={5} placeholder="Nowa sugestia lub błąd" />
        <textarea name="description" required minLength={10} placeholder="Co się dzieje i dlaczego to ważne?" />
        <div>
          <select name="category" defaultValue="FEATURE">
            <option value="FEATURE">Feature</option>
            <option value="BUG">Bug</option>
            <option value="IMPROVEMENT">Performance</option>
          </select>
          <select name="source" defaultValue="WEB_WIDGET">
            <option value="WEB_WIDGET">Web widget</option>
            <option value="DISCORD">Discord</option>
            <option value="GITHUB">GitHub</option>
            <option value="API">API</option>
          </select>
          <button><Plus size={16} /> Dodaj</button>
        </div>
      </form>
      <div className="roadmap">
        {roadmapStatuses.map((status) => (
          <div className="roadmapColumn" key={status}>
            <h2>{statusLabels[status]}</h2>
            {roadmap
              .filter((item) => item.status === status)
              .map((item) => (
                <article className="publicCard" key={item.id}>
                  <button onClick={() => vote(item.id)} title="Oddaj głos">
                    <ChevronUp size={18} />
                    {item.upvotesCount}
                  </button>
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                    <span>{categoryLabels[item.category]}</span>
                  </div>
                </article>
              ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function Aside({ state, enablePayments }: { state: AppState; enablePayments: boolean }) {
  const triageCount = state.feedbacks.filter((item) => item.status === "TRIAGE" && !item.mergedIntoId).length;
  const totalVotes = state.feedbacks.reduce((sum, item) => sum + item.upvotesCount, 0);

  return (
    <aside className="sidePanel">
      <section>
        <h2><Sparkles size={18} /> Core</h2>
        <dl>
          <div><dt>Triage</dt><dd>{triageCount}</dd></div>
          <div><dt>Głosy</dt><dd>{totalVotes}</dd></div>
          <div><dt>Latency target</dt><dd>&lt; 1s</dd></div>
        </dl>
      </section>
      <section>
        <h2><Webhook size={18} /> Wloty</h2>
        <div className="integration"><RadioTower size={16} /> Discord /suggest</div>
        <div className="integration"><Link2 size={16} /> Web widget</div>
        <div className="integration"><GitBranch size={16} /> GitHub issues</div>
      </section>
      <section>
        <h2><ShieldCheck size={18} /> Płatności</h2>
        <p className="paymentState">{enablePayments ? "Włączone dla nowych kont" : "Feature flag: wyłączone"}</p>
        <p>Early adopters mają plan Pro za 0 USD i mogą zostać lifetime free.</p>
      </section>
      <section>
        <h2><Bell size={18} /> Feedback loop</h2>
        {state.notifications.length === 0 ? (
          <p>Zmiana statusu na Wdrożone utworzy zdarzenie mail/Discord.</p>
        ) : (
          state.notifications.slice(0, 3).map((item) => (
            <div className="notification" key={item.id}>{item.message}</div>
          ))
        )}
      </section>
    </aside>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
