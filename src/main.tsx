import React, { useEffect, useMemo, useState } from "react";
import { DndContext, DragEndEvent, DragOverlay, useDraggable, useDroppable } from "@dnd-kit/core";
import { createRoot } from "react-dom/client";
import {
  Bell,
  Check,
  ChevronUp,
  Clock3,
  Copy,
  ExternalLink,
  GitBranch,
  Inbox,
  KanbanSquare,
  Link2,
  LogIn,
  LogOut,
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
  Trash2,
  UserRound,
  Waypoints,
  Webhook
} from "lucide-react";
import "./styles.css";
import type { Category, Feedback, Project, Source, Status } from "./types";
import {
  BoardResponse,
  createPublicFeedback,
  discordLoginUrl,
  fetchChangelog,
  fetchAdminFeedbacks,
  fetchPublicBoard,
  fetchProjectSettings,
  fetchSession,
  logout,
  mergeFeedback,
  ProjectSettingsResponse,
  SessionResponse,
  updateAdminFeedback,
  updateIntegration,
  updateProjectSettings,
  voteFeedback
} from "./lib/api";
import { adminStatuses, categoryLabels, compactDate, roadmapStatuses, statusLabels } from "./lib/store";

const ENABLE_PAYMENTS = import.meta.env.VITE_ENABLE_PAYMENTS === "true";
type View = "admin" | "portal" | "changelog" | "integrations" | "settings";
const PROJECT_SLUG = import.meta.env.VITE_PROJECT_SLUG ?? "orbit-chat";

function routeToView(): View {
  if (window.location.pathname.startsWith("/admin")) return "admin";
  if (window.location.pathname.startsWith("/changelog")) return "changelog";
  if (window.location.pathname.startsWith("/integrations")) return "integrations";
  if (window.location.pathname.startsWith("/settings")) return "settings";
  return "portal";
}

function App() {
  const [view, setViewState] = useState<View>(() => routeToView());
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [query, setQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<Status | "ALL">("ALL");
  const [project, setProject] = useState<Project | null>(null);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [adminKey, setAdminKey] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const onPopState = () => setViewState(routeToView());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    fetchSession()
      .then(setSession)
      .catch(() => setSession({ user: null, isAdmin: false, discordOAuthConfigured: false }));
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadData();
    }, 180);
    return () => window.clearTimeout(timeout);
  }, [view, selectedStatus, query, adminKey, session?.isAdmin]);

  const setView = (nextView: View) => {
    const paths: Record<View, string> = {
      admin: "/admin",
      portal: "/board",
      changelog: "/changelog",
      integrations: "/integrations",
      settings: "/settings"
    };
    const path = paths[nextView];
    window.history.pushState({}, "", path);
    setViewState(nextView);
  };

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (view === "admin" || view === "integrations" || view === "settings") {
        if (!session?.isAdmin && !adminKey) {
          setFeedbacks([]);
          return;
        }

        const data = await fetchAdminFeedbacks(adminKey || undefined, { status: selectedStatus, q: query });
        setFeedbacks(data.feedbacks);
        setProject((current) => current ?? {
          id: "orbit-chat",
          name: "Orbit Chat",
          slug: "orbit-chat",
          description: "Feedback workspace",
          ownerId: ""
        });
      } else if (view === "changelog") {
        const data = await fetchChangelog();
        setProject(data.project);
        setFeedbacks(data.feedbacks);
      } else {
        const data = await fetchPublicBoard();
        setProject(data.project);
        setFeedbacks(data.feedbacks);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nie udało się pobrać danych");
      if (view === "portal") {
        setFeedbacks([]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const visibleFeedbacks = useMemo(() => {
    return feedbacks
      .filter((item) => !item.mergedIntoId)
      .filter((item) => selectedStatus === "ALL" || item.status === selectedStatus)
      .filter((item) => {
        const haystack = `${item.title} ${item.description} ${item.tags.join(" ")}`.toLowerCase();
        return haystack.includes(query.toLowerCase());
      })
      .sort((a, b) => b.priority - a.priority || b.upvotesCount - a.upvotesCount);
  }, [feedbacks, query, selectedStatus]);

  const updateFeedback = async (id: string, patch: Partial<Feedback>) => {
    const before = feedbacks;
    setFeedbacks((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item))
    );

    try {
      const result = await updateAdminFeedback(id, patch, adminKey || undefined);
      setFeedbacks((current) => current.map((item) => (item.id === id ? { ...item, ...result.feedback } : item)));
    } catch (caught) {
      setFeedbacks(before);
      setError(caught instanceof Error ? caught.message : "Nie udało się zapisać zmiany");
    }
  };

  const addFeedback = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    try {
      const result = await createPublicFeedback({
        title: String(data.get("title") ?? ""),
        description: String(data.get("description") ?? ""),
        category: String(data.get("category") ?? "FEATURE") as Category,
        source: String(data.get("source") ?? "WEB_WIDGET") as Source
      });
      setFeedbacks((current) => [result.feedback, ...current]);
      form.reset();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nie udało się dodać zgłoszenia");
    }
  };

  const vote = async (id: string) => {
    const before = feedbacks;
    setFeedbacks((current) =>
      current.map((item) => (item.id === id ? { ...item, upvotesCount: item.upvotesCount + 1 } : item))
    );

    try {
      const result = await voteFeedback(id);
      setFeedbacks((current) => current.map((item) => (item.id === id ? { ...item, ...result.feedback } : item)));
    } catch (caught) {
      setFeedbacks(before);
      setError(caught instanceof Error ? caught.message : "Nie udało się oddać głosu");
    }
  };

  const mergeTopDuplicate = async (target: Feedback) => {
    const duplicate = feedbacks.find(
      (item) => item.id !== target.id && item.status === "TRIAGE" && item.category === target.category && !item.mergedIntoId
    );
    if (!duplicate) return;

    const before = feedbacks;
    setFeedbacks((current) => current.filter((item) => item.id !== duplicate.id));

    try {
      const result = await mergeFeedback(target.id, duplicate.id, adminKey || undefined);
      setFeedbacks((current) =>
        current.map((item) => (item.id === target.id ? { ...item, ...result.target } : item))
      );
    } catch (caught) {
      setFeedbacks(before);
      setError(caught instanceof Error ? caught.message : "Nie udało się scalić zgłoszeń");
    }
  };

  const projectName = project?.name ?? "Orbit Chat";
  const isAdmin = session?.isAdmin || Boolean(adminKey);

  if ((view === "admin" || view === "integrations" || view === "settings") && !isAdmin) {
    return (
      <main className="authShell">
        <AdminGate
          adminKey={adminKey}
          setAdminKey={setAdminKey}
          error={error}
          discordOAuthConfigured={session?.discordOAuthConfigured ?? false}
        />
      </main>
    );
  }

  return (
    <main className="shell">
      <Sidebar
        projectName={projectName}
        view={view}
        setView={setView}
        theme={theme}
        setTheme={setTheme}
        feedbacks={feedbacks}
        enablePayments={ENABLE_PAYMENTS}
        session={session}
      />
      <section className="workspace">
        {view === "admin" ? (
          <>
            <AdminToolbar
              query={query}
              setQuery={setQuery}
              selectedStatus={selectedStatus}
              setSelectedStatus={setSelectedStatus}
              isLoading={isLoading}
              error={error}
            />
            <AdminBoard feedbacks={visibleFeedbacks} updateFeedback={updateFeedback} mergeTopDuplicate={mergeTopDuplicate} />
          </>
        ) : view === "changelog" ? (
          <ChangelogView feedbacks={feedbacks} isLoading={isLoading} error={error} />
        ) : view === "integrations" ? (
          <IntegrationsView adminKey={adminKey || undefined} />
        ) : view === "settings" ? (
          <SettingsView
            project={project}
            session={session}
            adminKey={adminKey || undefined}
            onProjectSaved={setProject}
          />
        ) : (
          <Portal
            projectDescription={project?.description ?? "Publiczna roadmapa społeczności."}
            feedbacks={visibleFeedbacks}
            addFeedback={addFeedback}
            vote={vote}
            isLoading={isLoading}
            error={error}
          />
        )}
      </section>
    </main>
  );
}

function Sidebar({
  projectName,
  view,
  setView,
  theme,
  setTheme,
  feedbacks,
  enablePayments,
  session
}: {
  projectName: string;
  view: View;
  setView: (view: View) => void;
  theme: "light" | "dark";
  setTheme: (theme: "light" | "dark") => void;
  feedbacks: Feedback[];
  enablePayments: boolean;
  session: SessionResponse | null;
}) {
  const triageCount = feedbacks.filter((item) => item.status === "TRIAGE" && !item.mergedIntoId).length;
  const totalVotes = feedbacks.reduce((sum, item) => sum + item.upvotesCount, 0);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const user = session?.user;

  const handleLogout = async () => {
    await logout().catch(() => undefined);
    window.location.href = "/board";
  };

  return (
    <aside className="appSidebar">
      <div className="brand">
        <Rocket size={24} />
        <div>
          <strong>{projectName}</strong>
          <span>Feedback Forge</span>
        </div>
      </div>

      <div className="projectSwitch">
        <span>Projekt</span>
        <strong>{projectName}</strong>
      </div>

      <nav className="sideNav" aria-label="Nawigacja aplikacji">
        <button className={view === "admin" ? "active" : ""} onClick={() => setView("admin")}>
          <KanbanSquare size={17} /> Board
        </button>
        <button className={view === "portal" ? "active" : ""} onClick={() => setView("portal")}>
          <RadioTower size={17} /> Roadmapa
        </button>
        <button className={view === "changelog" ? "active" : ""} onClick={() => setView("changelog")}>
          <Clock3 size={17} /> Changelog
        </button>
        <button className={view === "integrations" ? "active" : ""} onClick={() => setView("integrations")}>
          <Webhook size={17} /> Wloty
        </button>
        <button className={view === "settings" ? "active" : ""} onClick={() => setView("settings")}>
          <ShieldCheck size={17} /> Ustawienia
        </button>
      </nav>

      <div className="sidebarSection">
        <h2><Sparkles size={16} /> Core</h2>
        <dl>
          <div><dt>Triage</dt><dd>{triageCount}</dd></div>
          <div><dt>Głosy</dt><dd>{totalVotes}</dd></div>
          <div><dt>Latency</dt><dd>&lt; 1s</dd></div>
        </dl>
      </div>

      <div className="sidebarSection">
        <h2><Waypoints size={16} /> Integracje</h2>
        <div className="integration"><RadioTower size={15} /> Discord /suggest</div>
        <div className="integration"><Link2 size={15} /> Web widget</div>
        <div className="integration"><GitBranch size={15} /> GitHub issues</div>
      </div>

      <div className="sidebarSection">
        <h2><ShieldCheck size={16} /> Płatności</h2>
        <p className="paymentState">{enablePayments ? "Włączone" : "Feature flag: wyłączone"}</p>
      </div>

      <div className="sidebarFooter">
        <button
          className="themeToggle"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          title={theme === "dark" ? "Jasny motyw" : "Ciemny motyw"}
        >
          {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
        </button>
        {user ? (
          <div className="profileMenuWrap">
            <button className="profileButton" onClick={() => setIsProfileOpen((current) => !current)}>
              {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : <UserRound size={18} />}
              <span>
                <strong>{user.name ?? "Admin"}</strong>
                <small>{user.role === "ADMIN" ? "Właściciel / Admin" : "Społeczność"}</small>
              </span>
            </button>
            {isProfileOpen ? (
              <div className="profileMenu">
                <div>
                  <strong>{user.name ?? "Użytkownik"}</strong>
                  <span>{user.email}</span>
                </div>
                <button type="button"><UserRound size={15} /> Edytuj profil</button>
                <button type="button" onClick={() => void handleLogout()}><LogOut size={15} /> Wyloguj</button>
              </div>
            ) : null}
          </div>
        ) : (
          <span>{theme === "dark" ? "Ciemny motyw" : "Jasny motyw"}</span>
        )}
      </div>
    </aside>
  );
}

function AdminGate({
  adminKey,
  setAdminKey,
  error,
  discordOAuthConfigured
}: {
  adminKey: string;
  setAdminKey: (value: string) => void;
  error: string | null;
  discordOAuthConfigured: boolean;
}) {
  return (
    <section className="authPanel">
      <div>
        <h1>Panel admina</h1>
        <p>Zaloguj się przed wejściem do panelu. Publiczna roadmapa pozostaje dostępna bez konta.</p>
      </div>
      {discordOAuthConfigured ? (
        <a className="loginButton" href={discordLoginUrl()}>
          <LogIn size={18} /> Zaloguj przez Discord
        </a>
      ) : (
        <p className="infoBanner">Discord OAuth nie jest skonfigurowany. Ustaw zmienne w Portainerze albo użyj klucza admina.</p>
      )}
      <label className="adminKeyBox">
        <span>Awaryjny ADMIN_API_KEY</span>
        <input
          value={adminKey}
          onChange={(event) => setAdminKey(event.target.value)}
          placeholder="Wklej klucz i poczekaj chwilę"
          type="password"
        />
      </label>
      {error ? <p className="errorBanner">{error}</p> : null}
    </section>
  );
}

function AdminToolbar({
  query,
  setQuery,
  selectedStatus,
  setSelectedStatus,
  isLoading,
  error
}: {
  query: string;
  setQuery: (value: string) => void;
  selectedStatus: Status | "ALL";
  setSelectedStatus: (status: Status | "ALL") => void;
  isLoading: boolean;
  error: string | null;
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
      <div className="toolbarState">{isLoading ? "Synchronizacja..." : error ?? "API online"}</div>
    </div>
  );
}

function AdminBoard({
  feedbacks,
  updateFeedback,
  mergeTopDuplicate
}: {
  feedbacks: Feedback[];
  updateFeedback: (id: string, patch: Partial<Feedback>) => Promise<void>;
  mergeTopDuplicate: (target: Feedback) => Promise<void>;
}) {
  const [activeFeedback, setActiveFeedback] = useState<Feedback | null>(null);

  const handleDragEnd = (event: DragEndEvent) => {
    const feedbackId = String(event.active.id);
    const nextStatus = event.over?.id as Status | undefined;
    const current = feedbacks.find((item) => item.id === feedbackId);

    setActiveFeedback(null);

    if (!current || !nextStatus || current.status === nextStatus) return;
    if (!adminStatuses.includes(nextStatus)) return;

    void updateFeedback(feedbackId, { status: nextStatus });
  };

  return (
    <DndContext
      onDragStart={(event) => setActiveFeedback(feedbacks.find((item) => item.id === event.active.id) ?? null)}
      onDragCancel={() => setActiveFeedback(null)}
      onDragEnd={handleDragEnd}
    >
      <section className="kanban" aria-label="Tablica triage">
        {adminStatuses.map((status) => (
          <KanbanLane
            key={status}
            status={status}
            feedbacks={feedbacks.filter((item) => item.status === status)}
            mergeTopDuplicate={mergeTopDuplicate}
          />
        ))}
      </section>
      <DragOverlay>
        {activeFeedback ? <FeedbackCard feedback={activeFeedback} onMerge={() => undefined} isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function KanbanLane({
  status,
  feedbacks,
  mergeTopDuplicate
}: {
  status: Status;
  feedbacks: Feedback[];
  mergeTopDuplicate: (target: Feedback) => Promise<void>;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: status });

  return (
    <div className={`lane ${isOver ? "isOver" : ""}`} ref={setNodeRef}>
      <div className="laneHeader">
        <span>{statusLabels[status]}</span>
        <b>{feedbacks.length}</b>
      </div>
      <div className="laneStack">
        {feedbacks.length === 0 ? (
          <div className="emptyLane">Upuść tutaj</div>
        ) : (
          feedbacks.map((item) => <FeedbackCard key={item.id} feedback={item} onMerge={() => void mergeTopDuplicate(item)} />)
        )}
      </div>
    </div>
  );
}

function FeedbackCard({
  feedback,
  onMerge,
  isOverlay = false
}: {
  feedback: Feedback;
  onMerge: () => void;
  isOverlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: feedback.id,
    disabled: isOverlay
  });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;

  return (
    <article
      className={`feedbackCard ${isDragging ? "isDragging" : ""} ${isOverlay ? "dragOverlay" : ""}`}
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
    >
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
        <span className="priorityBadge">P{feedback.priority}</span>
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
  isLoading,
  error
}: {
  projectDescription: string;
  feedbacks: Feedback[];
  addFeedback: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  vote: (id: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
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
          <span><Bell size={18} /> {isLoading ? "sync" : "online"}</span>
        </div>
      </div>
      {error ? <p className="errorBanner">{error}</p> : null}
      <form className="submitBox" onSubmit={(event) => void addFeedback(event)}>
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
                  <button onClick={() => void vote(item.id)} title="Oddaj głos">
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

function ChangelogView({
  feedbacks,
  isLoading,
  error
}: {
  feedbacks: Feedback[];
  isLoading: boolean;
  error: string | null;
}) {
  return (
    <section className="contentView">
      <div className="viewHeader">
        <div>
          <h1>Changelog</h1>
          <p>Publiczna kronika zmian powstaje z kart przesuniętych do kolumny Wdrożone.</p>
        </div>
        <span className="statusPill">{isLoading ? "Synchronizacja" : `${feedbacks.length} wpisów`}</span>
      </div>
      {error ? <p className="errorBanner">{error}</p> : null}
      <div className="timeline">
        {feedbacks.length === 0 ? (
          <div className="emptyState">Brak wdrożonych zmian. Przesuń kartę do Wdrożone, żeby utworzyć wpis.</div>
        ) : (
          feedbacks.map((item) => (
            <article className="timelineItem" key={item.id}>
              <time>{compactDate(item.updatedAt)}</time>
              <div>
                <h2>Wdrożono: {item.title}</h2>
                <p>{item.description}</p>
                <span>{categoryLabels[item.category]}</span>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function useAdminProjectSettings(adminKey?: string) {
  const [settings, setSettings] = useState<ProjectSettingsResponse | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    fetchProjectSettings(adminKey)
      .then((data) => {
        if (isMounted) {
          setSettings(data);
          setSettingsError(null);
        }
      })
      .catch((caught) => {
        if (isMounted) setSettingsError(caught instanceof Error ? caught.message : "Nie udało się pobrać ustawień");
      });

    return () => {
      isMounted = false;
    };
  }, [adminKey]);

  return { settings, settingsError, setSettings };
}

function IntegrationsView({ adminKey }: { adminKey?: string }) {
  const { settings, settingsError, setSettings } = useAdminProjectSettings(adminKey);
  const discordConfig = settings?.integrations.find((item) => item.provider === "DISCORD")?.config ?? {};
  const githubConfig = settings?.integrations.find((item) => item.provider === "GITHUB")?.config ?? {};
  const widgetSnippet =
    settings?.instructions.widgetSnippet ??
    `<script async src="${window.location.origin}/widget.js" data-project="${PROJECT_SLUG}"></script>`;
  const apiBaseUrl = settings?.instructions.apiBaseUrl ?? window.location.origin;
  const discordWebhookUrl = settings?.instructions.discordWebhookUrl ?? `${window.location.origin}/api/v1/webhooks/discord/suggest`;
  const githubWebhookUrl = settings?.instructions.githubWebhookUrl ?? `${window.location.origin}/api/v1/webhooks/github/issues`;
  const [discordChannelId, setDiscordChannelId] = useState("");
  const [githubRepository, setGithubRepository] = useState("");
  const [saveState, setSaveState] = useState<string | null>(null);

  useEffect(() => {
    setDiscordChannelId(String(discordConfig.channelId ?? ""));
    setGithubRepository(String(githubConfig.repository ?? ""));
  }, [discordConfig.channelId, githubConfig.repository]);

  const copyText = async (text: string, message: string) => {
    await navigator.clipboard.writeText(text);
    setSaveState(message);
  };

  const saveDiscord = async () => {
    setSaveState("Zapisuję Discord...");
    try {
      const result = await updateIntegration("DISCORD", { enabled: true, config: { channelId: discordChannelId } }, adminKey);
      setSettings((current) =>
        current
          ? {
              ...current,
              integrations: [
                ...current.integrations.filter((item) => item.provider !== "DISCORD"),
                result.integration
              ]
            }
          : current
      );
      setSaveState("Zapisano konfigurację Discorda");
    } catch (caught) {
      setSaveState(caught instanceof Error ? caught.message : "Nie udało się zapisać Discorda");
    }
  };

  const saveGithub = async () => {
    setSaveState("Zapisuję GitHub...");
    try {
      const result = await updateIntegration("GITHUB", { enabled: true, config: { repository: githubRepository } }, adminKey);
      setSettings((current) =>
        current
          ? {
              ...current,
              integrations: [
                ...current.integrations.filter((item) => item.provider !== "GITHUB"),
                result.integration
              ]
            }
          : current
      );
      setSaveState("Zapisano konfigurację GitHuba");
    } catch (caught) {
      setSaveState(caught instanceof Error ? caught.message : "Nie udało się zapisać GitHuba");
    }
  };

  return (
    <section className="contentView">
      <div className="viewHeader">
        <div>
          <h1>Wloty</h1>
          <p>Źródła, z których feedback spływa automatycznie do triage.</p>
        </div>
      </div>
      {settingsError ? <p className="errorBanner">{settingsError}</p> : null}
      {saveState ? <p className="successBanner">{saveState}</p> : null}
      <div className="settingsGrid">
        <article className="settingsCard">
          <h2><RadioTower size={18} /> Bot Discorda</h2>
          <p>Gotowy skrypt `bot/discord-suggest.js` wymaga tych zmiennych w kontenerze bota. `API_BASE_URL` to adres Twojej aplikacji bez końcówki `/api`.</p>
          <label>
            ID kanału zgłoszeń
            <input value={discordChannelId} onChange={(event) => setDiscordChannelId(event.target.value)} placeholder="np. 123456789012345678" />
          </label>
          <code>API_BASE_URL={apiBaseUrl}</code>
          <code>PROJECT_SLUG={PROJECT_SLUG}</code>
          <code>DISCORD_BOT_TOKEN=wklej_token_bota</code>
          <code>DISCORD_CLIENT_ID=wklej_client_id_aplikacji</code>
          <code>DISCORD_GUILD_ID=opcjonalnie_id_serwera</code>
          <p>Webhook techniczny, jeśli kiedyś użyjesz własnej integracji zamiast bota: {discordWebhookUrl}</p>
          <button className="secondaryButton" onClick={() => void saveDiscord()}><Check size={16} /> Zapisz Discord</button>
          <button className="secondaryButton" onClick={() => void copyText(`API_BASE_URL=${apiBaseUrl}\nPROJECT_SLUG=${PROJECT_SLUG}\nDISCORD_BOT_TOKEN=\nDISCORD_CLIENT_ID=\nDISCORD_GUILD_ID=`, "Skopiowano zmienne bota Discord")}><Copy size={16} /> Kopiuj zmienne bota</button>
        </article>
        <article className="settingsCard">
          <h2><Link2 size={18} /> Web Widget</h2>
          <p>Wklej ten snippet przed `&lt;/body&gt;` na stronie aplikacji lub dokumentacji.</p>
          <code>{widgetSnippet}</code>
          <button className="secondaryButton" onClick={() => void copyText(widgetSnippet, "Skopiowano snippet widgetu")}><Copy size={16} /> Kopiuj snippet</button>
        </article>
        <article className="settingsCard">
          <h2><GitBranch size={18} /> GitHub Sync</h2>
          <p>Webhook GitHuba powinien wysyłać issue na endpoint importu. Na razie zapisujemy repozytorium do konfiguracji projektu.</p>
          <label>
            Repozytorium
            <input value={githubRepository} onChange={(event) => setGithubRepository(event.target.value)} placeholder="owner/repository" />
          </label>
          <code>{githubWebhookUrl}</code>
          <button className="secondaryButton" onClick={() => void saveGithub()}><Check size={16} /> Zapisz GitHub</button>
          <button className="secondaryButton" onClick={() => void copyText(githubWebhookUrl, "Skopiowano endpoint GitHuba")}><Copy size={16} /> Kopiuj endpoint</button>
        </article>
      </div>
    </section>
  );
}

function SettingsView({
  project,
  session,
  adminKey,
  onProjectSaved
}: {
  project: Project | null;
  session: SessionResponse | null;
  adminKey?: string;
  onProjectSaved: (project: Project) => void;
}) {
  const { settings, settingsError } = useAdminProjectSettings(adminKey);
  const currentProject = settings?.project ?? project;
  const [name, setName] = useState(currentProject?.name ?? "Orbit Chat");
  const [description, setDescription] = useState(currentProject?.description ?? "");
  const [customDomain, setCustomDomain] = useState(currentProject?.customDomain ?? "");
  const [moderatorDiscordIds, setModeratorDiscordIds] = useState((currentProject?.moderatorDiscordIds ?? []).join(", "));
  const [publicRoadmap, setPublicRoadmap] = useState(currentProject?.publicRoadmap ?? true);
  const [requireLoginToVote, setRequireLoginToVote] = useState(currentProject?.requireLoginToVote ?? false);
  const [saveState, setSaveState] = useState<string | null>(null);

  useEffect(() => {
    if (!currentProject) return;
    setName(currentProject.name);
    setDescription(currentProject.description ?? "");
    setCustomDomain(currentProject.customDomain ?? "");
    setModeratorDiscordIds((currentProject.moderatorDiscordIds ?? []).join(", "));
    setPublicRoadmap(currentProject.publicRoadmap ?? true);
    setRequireLoginToVote(currentProject.requireLoginToVote ?? false);
  }, [currentProject?.id, currentProject?.updatedAt]);

  const saveSettings = async () => {
    setSaveState("Zapisuję ustawienia...");
    try {
      const result = await updateProjectSettings(
        {
          name,
          description,
          customDomain,
          moderatorDiscordIds: moderatorDiscordIds
            .split(",")
            .map((id) => id.trim())
            .filter(Boolean),
          publicRoadmap,
          requireLoginToVote
        },
        adminKey
      );
      onProjectSaved(result.project);
      setSaveState("Zapisano ustawienia projektu");
    } catch (caught) {
      setSaveState(caught instanceof Error ? caught.message : "Nie udało się zapisać ustawień");
    }
  };

  return (
    <section className="contentView">
      <div className="viewHeader">
        <div>
          <h1>Ustawienia</h1>
          <p>Konfiguracja projektu, domeny, zespołu i widoczności roadmapy.</p>
        </div>
        <button className="primaryButton" onClick={() => void saveSettings()}><Check size={16} /> Zapisz zmiany</button>
      </div>
      {settingsError ? <p className="errorBanner">{settingsError}</p> : null}
      {saveState ? <p className="successBanner">{saveState}</p> : null}
      <div className="settingsGrid">
        <article className="settingsCard">
          <h2>Ogólne</h2>
          <label>
            Nazwa projektu
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            Opis
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
        </article>
        <article className="settingsCard">
          <h2>Własna domena</h2>
          <label>
            Domena
            <input value={customDomain} onChange={(event) => setCustomDomain(event.target.value)} placeholder="feedback.twojadomena.pl" />
          </label>
          <p>Po podpięciu DNS ustaw `PUBLIC_BASE_URL` i redirect Discord OAuth na tę domenę, a potem zapisz tutaj sam host.</p>
        </article>
        <article className="settingsCard">
          <h2>Uprawnienia / Zespół</h2>
          <p>Aktualny admin: {session?.user?.name ?? "Brak sesji"}.</p>
          <label>
            Discord ID moderatorów
            <input value={moderatorDiscordIds} onChange={(event) => setModeratorDiscordIds(event.target.value)} placeholder="123...,456..." />
          </label>
        </article>
        <article className="settingsCard">
          <h2>Prywatność</h2>
          <label className="toggleRow">
            <input type="checkbox" checked={publicRoadmap} onChange={(event) => setPublicRoadmap(event.target.checked)} />
            Roadmapa publiczna
          </label>
          <label className="toggleRow">
            <input type="checkbox" checked={requireLoginToVote} onChange={(event) => setRequireLoginToVote(event.target.checked)} />
            Wymagaj logowania do głosowania
          </label>
        </article>
        <article className="settingsCard dangerCard">
          <h2>Danger Zone</h2>
          <p>Operacje destrukcyjne powinny wymagać ponownego potwierdzenia.</p>
          <button className="dangerButton"><Trash2 size={16} /> Zresetuj dane projektu</button>
        </article>
      </div>
    </section>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
