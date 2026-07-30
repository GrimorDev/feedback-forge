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
  createAdminProject,
  createPublicFeedback,
  discordLoginUrl,
  fetchChangelog,
  fetchAdminFeedbacks,
  fetchAdminProjects,
  fetchDiscordChannels,
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
const DEFAULT_PROJECT_SLUG = import.meta.env.VITE_PROJECT_SLUG ?? "orbit-chat";
type View =
  | "landing"
  | "adminHome"
  | "admin"
  | "adminRoadmap"
  | "adminChangelog"
  | "portal"
  | "changelog"
  | "integrations"
  | "settings";
type RouteState = {
  view: View;
  projectSlug: string;
};

function parseRoute(): RouteState {
  const parts = window.location.pathname.split("/").filter(Boolean);

  if (parts[0] === "p" && parts[1]) {
    return {
      view: parts[2] === "changelog" ? "changelog" : "portal",
      projectSlug: decodeURIComponent(parts[1])
    };
  }

  if (parts[0] === "admin" && parts[1] === "projects" && parts[2]) {
    const view =
      parts[3] === "integrations" || parts[3] === "wloty"
        ? "integrations"
        : parts[3] === "roadmap"
          ? "adminRoadmap"
          : parts[3] === "changelog"
            ? "adminChangelog"
        : parts[3] === "settings"
          ? "settings"
          : "admin";
    return { view, projectSlug: decodeURIComponent(parts[2]) };
  }

  if (parts[0] === "board") return { view: "portal", projectSlug: DEFAULT_PROJECT_SLUG };
  if (parts[0] === "changelog") return { view: "changelog", projectSlug: DEFAULT_PROJECT_SLUG };
  if (parts[0] === "admin") return { view: "adminHome", projectSlug: DEFAULT_PROJECT_SLUG };

  return { view: "landing", projectSlug: DEFAULT_PROJECT_SLUG };
}

function App() {
  const [route, setRoute] = useState<RouteState>(() => parseRoute());
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [query, setQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<Status | "ALL">("ALL");
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
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
    const onPopState = () => setRoute(parseRoute());
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
  }, [route.view, route.projectSlug, selectedStatus, query, adminKey, session?.isAdmin]);

  const setView = (nextView: View, nextProjectSlug = route.projectSlug) => {
    const paths: Record<View, string> = {
      landing: "/",
      adminHome: "/admin",
      admin: `/admin/projects/${nextProjectSlug}/board`,
      adminRoadmap: `/admin/projects/${nextProjectSlug}/roadmap`,
      adminChangelog: `/admin/projects/${nextProjectSlug}/changelog`,
      portal: `/p/${nextProjectSlug}`,
      changelog: `/p/${nextProjectSlug}/changelog`,
      integrations: `/admin/projects/${nextProjectSlug}/wloty`,
      settings: `/admin/projects/${nextProjectSlug}/settings`
    };
    const path = paths[nextView];
    window.history.pushState({}, "", path);
    setRoute({ view: nextView, projectSlug: nextProjectSlug });
  };

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (route.view === "landing") {
        setFeedbacks([]);
        return;
      }

      if (route.view === "adminHome") {
        setFeedbacks([]);
        setProject(null);
        return;
      }

      if (route.view === "admin" || route.view === "integrations" || route.view === "settings") {
        if (!session?.isAdmin && !adminKey) {
          setFeedbacks([]);
          return;
        }

        const data = await fetchAdminFeedbacks(route.projectSlug, adminKey || undefined, { status: selectedStatus, q: query });
        setFeedbacks(data.feedbacks);
        setProject((current) => current ?? {
          id: route.projectSlug,
          name: route.projectSlug,
          slug: route.projectSlug,
          description: "Feedback workspace",
          ownerId: ""
        });
      } else if (route.view === "changelog" || route.view === "adminChangelog") {
        const data = await fetchChangelog(route.projectSlug);
        setProject(data.project);
        setFeedbacks(data.feedbacks);
      } else {
        const data = await fetchPublicBoard(route.projectSlug);
        setProject(data.project);
        setFeedbacks(data.feedbacks);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nie udało się pobrać danych");
      if (route.view === "portal") {
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
        projectSlug: route.projectSlug,
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

  const projectName = project?.name ?? route.projectSlug;
  const isAdmin = Boolean(session?.user) || Boolean(adminKey);
  const isAdminView =
    route.view === "adminHome" ||
    route.view === "admin" ||
    route.view === "adminRoadmap" ||
    route.view === "adminChangelog" ||
    route.view === "integrations" ||
    route.view === "settings";

  if (route.view === "landing") {
    return (
      <LandingView
        theme={theme}
        setTheme={setTheme}
        session={session}
        openDemo={() => setView("portal", DEFAULT_PROJECT_SLUG)}
      />
    );
  }

  if (isAdminView && !isAdmin) {
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

  if (!isAdminView) {
    return (
      <PublicShell
        projectName={projectName}
        view={route.view}
        setView={setView}
        theme={theme}
        setTheme={setTheme}
        session={session}
        onReportClick={() => {
          setIsSubmitOpen(true);
          if (route.view !== "portal") setView("portal");
        }}
      >
        {route.view === "changelog" ? (
          <ChangelogView feedbacks={feedbacks} isLoading={isLoading} error={error} />
        ) : (
          <Portal
            projectDescription={project?.description ?? "Publiczna roadmapa społeczności."}
            feedbacks={visibleFeedbacks}
            addFeedback={addFeedback}
            vote={vote}
            isLoading={isLoading}
            error={error}
            isSubmitOpen={isSubmitOpen}
            setIsSubmitOpen={setIsSubmitOpen}
          />
        )}
      </PublicShell>
    );
  }

  if (route.view === "adminHome") {
    return (
      <main className="adminHomeShell">
        <AdminProjectsHome adminKey={adminKey || undefined} openProject={(slug) => setView("admin", slug)} />
      </main>
    );
  }

  return (
    <main className="shell">
      <Sidebar
        projectName={projectName}
        projectSlug={route.projectSlug}
        view={route.view}
        setView={setView}
        theme={theme}
        setTheme={setTheme}
        feedbacks={feedbacks}
        enablePayments={ENABLE_PAYMENTS}
        session={session}
      />
      <section className="workspace">
        {route.view === "admin" ? (
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
        ) : route.view === "adminRoadmap" ? (
          <section className="adminPreview">
            <div className="previewNotice">
              <div>
                <strong>Podgląd publicznej roadmapy</strong>
                <span>To widok, który dostaje społeczność pod adresem /p/{route.projectSlug}.</span>
              </div>
              <a className="secondaryButton" href={`/p/${route.projectSlug}`} target="_blank" rel="noreferrer">
                <ExternalLink size={16} /> Otwórz publiczny link
              </a>
            </div>
            <Portal
              projectDescription={project?.description ?? "Publiczna roadmapa społeczności."}
              feedbacks={visibleFeedbacks}
              addFeedback={addFeedback}
              vote={vote}
              isLoading={isLoading}
              error={error}
              isSubmitOpen={isSubmitOpen}
              setIsSubmitOpen={setIsSubmitOpen}
            />
          </section>
        ) : route.view === "adminChangelog" ? (
          <section className="adminPreview">
            <div className="previewNotice">
              <div>
                <strong>Podgląd publicznego changelogu</strong>
                <span>Admin zostaje w panelu, a publiczny link otwiera się osobno.</span>
              </div>
              <a className="secondaryButton" href={`/p/${route.projectSlug}/changelog`} target="_blank" rel="noreferrer">
                <ExternalLink size={16} /> Otwórz publiczny link
              </a>
            </div>
            <ChangelogView feedbacks={feedbacks} isLoading={isLoading} error={error} />
          </section>
        ) : route.view === "integrations" ? (
          <IntegrationsView projectSlug={route.projectSlug} adminKey={adminKey || undefined} />
        ) : route.view === "settings" ? (
          <SettingsView
            project={project}
            session={session}
            projectSlug={route.projectSlug}
            adminKey={adminKey || undefined}
            onProjectSaved={setProject}
          />
        ) : null}
      </section>
    </main>
  );
}

function AdminProjectsHome({
  adminKey,
  openProject
}: {
  adminKey?: string;
  openProject: (slug: string) => void;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const loadProjects = async () => {
    try {
      const data = await fetchAdminProjects(adminKey);
      setProjects(data.projects);
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : "Nie udało się pobrać projektów");
    }
  };

  useEffect(() => {
    void loadProjects();
  }, [adminKey]);

  const createProject = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("Tworzę projekt...");
    try {
      const result = await createAdminProject({ name, description: description || undefined }, adminKey);
      setProjects((current) => [result.project, ...current]);
      setName("");
      setDescription("");
      setStatus("Projekt utworzony");
      openProject(result.project.slug);
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : "Nie udało się utworzyć projektu");
    }
  };

  return (
    <section className="contentView">
      <div className="viewHeader">
        <div>
          <h1>Moje projekty</h1>
          <p>Każdy projekt ma własny publiczny link i osobny panel zarządzania.</p>
        </div>
      </div>
      {status ? <p className={status.includes("Nie ") || status.includes("Unauthorized") ? "errorBanner" : "successBanner"}>{status}</p> : null}
      <form className="settingsCard createProjectForm" onSubmit={(event) => void createProject(event)}>
        <h2><Plus size={18} /> Stwórz nowy projekt</h2>
        <label>
          Nazwa
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Pulse App" required minLength={2} />
        </label>
        <label>
          Opis
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Krótki opis roadmapy dla społeczności" />
        </label>
        <button className="primaryButton"><Plus size={16} /> Utwórz projekt</button>
      </form>
      <div className="projectGrid">
        {projects.map((item) => (
          <article className="projectCard" key={item.id}>
            <div>
              <h2>{item.name}</h2>
              <p>/p/{item.slug}</p>
            </div>
            <button className="secondaryButton" onClick={() => openProject(item.slug)}>
              <KanbanSquare size={16} /> Otwórz panel
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function PublicShell({
  projectName,
  view,
  setView,
  theme,
  setTheme,
  session,
  onReportClick,
  children
}: {
  projectName: string;
  view: View;
  setView: (view: View, projectSlug?: string) => void;
  theme: "light" | "dark";
  setTheme: (theme: "light" | "dark") => void;
  session: SessionResponse | null;
  onReportClick: () => void;
  children: React.ReactNode;
}) {
  const needsDiscordLogin = false;

  if (needsDiscordLogin) {
    return (
      <section className="contentView">
        <div className="viewHeader">
          <div>
            <h1>Prywatny changelog</h1>
            <p>Zaloguj się Discordem, żeby sprawdzić aktualizacje tej społeczności.</p>
          </div>
          <a className="publicLoginButton" href={discordLoginUrl(window.location.pathname)}>
            <LogIn size={16} /> Zaloguj z Discordem
          </a>
        </div>
      </section>
    );
  }

  return (
    <main className="publicShell">
      <header className="publicTopbar">
        <button className="publicBrand" onClick={() => setView("portal")} aria-label="Przejdź do roadmapy">
          <Rocket size={23} />
          <span>
            <strong>{projectName}</strong>
            <small>Feedback Forge</small>
          </span>
        </button>
        <nav className="publicNav" aria-label="Nawigacja publiczna">
          <button className={view === "portal" ? "active" : ""} onClick={() => setView("portal")}>
            Roadmapa
          </button>
          <button className={view === "changelog" ? "active" : ""} onClick={() => setView("changelog")}>
            Changelog
          </button>
        </nav>
        <div className="publicActions">
          <button className="publicReportButton" onClick={onReportClick}>
            <Plus size={16} /> Zgłoś
          </button>
          {session?.isAdmin ? (
            <button className="publicAdminButton" onClick={() => setView("adminHome")}>
              <KanbanSquare size={16} /> Panel admina
            </button>
          ) : session?.user ? (
            <span className="publicUser">{session.user.name ?? "Konto"}</span>
          ) : session?.discordOAuthConfigured ? (
            <a className="publicLoginButton" href={discordLoginUrl("/admin")}>
              <LogIn size={16} /> Zaloguj
            </a>
          ) : null}
          <button
            className="themeToggle"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            title={theme === "dark" ? "Jasny motyw" : "Ciemny motyw"}
          >
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </div>
      </header>
      <section className="publicWorkspace">{children}</section>
    </main>
  );
}

function LandingView({
  theme,
  setTheme,
  session,
  openDemo
}: {
  theme: "light" | "dark";
  setTheme: (theme: "light" | "dark") => void;
  session: SessionResponse | null;
  openDemo: () => void;
}) {
  return (
    <main className="landingShell">
      <header className="publicTopbar">
        <button className="publicBrand" onClick={openDemo} aria-label="Otwórz przykładową roadmapę">
          <Rocket size={23} />
          <span>
            <strong>Feedback Forge</strong>
            <small>Roadmapy dla społeczności</small>
          </span>
        </button>
        <nav className="publicNav" aria-label="Nawigacja">
          <button className="active" onClick={openDemo}>Demo projektu</button>
        </nav>
        <div className="publicActions">
          {session?.isAdmin ? (
            <button className="publicAdminButton" onClick={() => { window.location.href = "/admin"; }}>
              <KanbanSquare size={16} /> Panel admina
            </button>
          ) : session?.discordOAuthConfigured ? (
            <a className="publicLoginButton" href={discordLoginUrl("/admin")}>
              <LogIn size={16} /> Zaloguj
            </a>
          ) : null}
          <button
            className="themeToggle"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            title={theme === "dark" ? "Jasny motyw" : "Ciemny motyw"}
          >
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </div>
      </header>
      <section className="landingHero">
        <div>
          <h1>Jedna roadmapa dla każdej społeczności.</h1>
          <p>Udostępniaj graczom i użytkownikom osobny link w formacie `/p/nazwa-projektu`, a zaplecze trzymaj pod `/admin/projects/nazwa-projektu`.</p>
          <button className="publicReportButton" onClick={openDemo}>
            <ExternalLink size={16} /> Otwórz demo Orbit Chat
          </button>
        </div>
      </section>
    </main>
  );
}

function Sidebar({
  projectName,
  projectSlug,
  view,
  setView,
  theme,
  setTheme,
  feedbacks,
  enablePayments,
  session
}: {
  projectName: string;
  projectSlug: string;
  view: View;
  setView: (view: View, projectSlug?: string) => void;
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
    window.location.href = `/p/${projectSlug}`;
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
        <button className={view === "adminRoadmap" ? "active" : ""} onClick={() => setView("adminRoadmap")}>
          <RadioTower size={17} /> Roadmapa
        </button>
        <button className={view === "adminChangelog" ? "active" : ""} onClick={() => setView("adminChangelog")}>
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
  error,
  isSubmitOpen,
  setIsSubmitOpen
}: {
  projectDescription: string;
  feedbacks: Feedback[];
  addFeedback: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  vote: (id: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  isSubmitOpen: boolean;
  setIsSubmitOpen: (isOpen: boolean) => void;
}) {
  const roadmap = feedbacks.filter((item) => roadmapStatuses.includes(item.status));
  const completed = feedbacks.filter((item) => item.status === "COMPLETED");
  const needsDiscordLogin = error?.toLowerCase().includes("discord login");

  if (needsDiscordLogin) {
    return (
      <section className="contentView">
        <div className="viewHeader">
          <div>
            <h1>Prywatna roadmapa</h1>
            <p>Ten projekt jest dostępny tylko po zalogowaniu Discordem i spełnieniu wymagań społeczności.</p>
          </div>
          <a className="publicLoginButton" href={discordLoginUrl(window.location.pathname)}>
            <LogIn size={16} /> Zaloguj z Discordem
          </a>
        </div>
      </section>
    );
  }

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
      {isSubmitOpen ? (
        <form
          className="submitBox"
          id="submit-feedback"
          onSubmit={(event) => {
            void addFeedback(event);
            setIsSubmitOpen(false);
          }}
        >
          <div className="submitHeader">
            <strong>Nowe zgłoszenie</strong>
            <button type="button" onClick={() => setIsSubmitOpen(false)}>Zamknij</button>
          </div>
          <input name="title" required minLength={5} placeholder="Krótki tytuł sugestii lub błędu" />
          <textarea name="description" required minLength={10} placeholder="Co się dzieje i dlaczego to ważne?" />
          <div className="submitFields">
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
            <button><Plus size={16} /> Wyślij</button>
          </div>
        </form>
      ) : null}
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
  const needsDiscordLogin = error?.toLowerCase().includes("discord login");

  if (needsDiscordLogin) {
    return (
      <section className="contentView">
        <div className="viewHeader">
          <div>
            <h1>Prywatny changelog</h1>
            <p>Zaloguj się Discordem, żeby sprawdzić aktualizacje tej społeczności.</p>
          </div>
          <a className="publicLoginButton" href={discordLoginUrl(window.location.pathname)}>
            <LogIn size={16} /> Zaloguj z Discordem
          </a>
        </div>
      </section>
    );
  }

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

function useAdminProjectSettings(projectSlug: string, adminKey?: string) {
  const [settings, setSettings] = useState<ProjectSettingsResponse | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    fetchProjectSettings(projectSlug, adminKey)
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
  }, [projectSlug, adminKey]);

  return { settings, settingsError, setSettings };
}

function IntegrationsView({ projectSlug, adminKey }: { projectSlug: string; adminKey?: string }) {
  const { settings, settingsError, setSettings } = useAdminProjectSettings(projectSlug, adminKey);
  const discordConfig = settings?.integrations.find((item) => item.provider === "DISCORD")?.config ?? {};
  const githubConfig = settings?.integrations.find((item) => item.provider === "GITHUB")?.config ?? {};
  const widgetSnippet =
    settings?.instructions.widgetSnippet ??
    `<script async src="${window.location.origin}/widget.js" data-project="${projectSlug}"></script>`;
  const githubWebhookUrl = settings?.instructions.githubWebhookUrl ?? `${window.location.origin}/api/v1/webhooks/github/issues`;
  const [discordChannelId, setDiscordChannelId] = useState("");
  const [discordGuildId, setDiscordGuildId] = useState("");
  const [discordChannels, setDiscordChannels] = useState<Array<{ id: string; name: string }>>([]);
  const [discordChannelsState, setDiscordChannelsState] = useState<string | null>(null);
  const [githubRepository, setGithubRepository] = useState("");
  const [saveState, setSaveState] = useState<string | null>(null);
  const inviteUrl = settings?.instructions.discordBotInviteUrl ?? "";
  const isDiscordConnected = Boolean(discordConfig.guildId && discordConfig.channelId);

  useEffect(() => {
    setDiscordChannelId(String(discordConfig.channelId ?? ""));
    setDiscordGuildId(String(discordConfig.guildId ?? ""));
    setGithubRepository(String(githubConfig.repository ?? ""));
  }, [discordConfig.channelId, discordConfig.guildId, githubConfig.repository]);

  useEffect(() => {
    const trimmedGuildId = discordGuildId.trim();
    if (trimmedGuildId.length < 8) {
      setDiscordChannels([]);
      setDiscordChannelsState(null);
      return;
    }

    let isMounted = true;
    setDiscordChannelsState("Ładuję kanały z Discorda...");
    fetchDiscordChannels(projectSlug, trimmedGuildId, adminKey)
      .then((data) => {
        if (!isMounted) return;
        setDiscordChannels(data.channels);
        setDiscordChannelsState(data.channels.length ? null : "Bot nie widzi kanałów tekstowych na tym serwerze.");
      })
      .catch((caught) => {
        if (!isMounted) return;
        setDiscordChannels([]);
        setDiscordChannelsState(caught instanceof Error ? caught.message : "Nie udało się pobrać kanałów Discorda.");
      });

    return () => {
      isMounted = false;
    };
  }, [discordGuildId, projectSlug, adminKey]);

  const copyText = async (text: string, message: string) => {
    await navigator.clipboard.writeText(text);
    setSaveState(message);
  };

  const saveDiscord = async () => {
    setSaveState("Zapisuję Discord...");
    try {
      const result = await updateIntegration(
        projectSlug,
        "DISCORD",
        { enabled: true, config: { channelId: discordChannelId, guildId: discordGuildId } },
        adminKey
      );
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
      const result = await updateIntegration(projectSlug, "GITHUB", { enabled: true, config: { repository: githubRepository } }, adminKey);
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
      <div className="integrationGrid">
        <article className="settingsCard integrationCard integrationCardPrimary">
          <h2><RadioTower size={18} /> Bot Discorda</h2>
          <ol className="setupSteps">
            <li><strong>1. Dodaj bota</strong><span>Kliknij przycisk i wybierz swój serwer w oknie Discorda.</span></li>
            <li><strong>2. Powiąż serwer</strong><span>Wklej ID serwera, żeby system wiedział, do którego projektu wpinać sugestie.</span></li>
            <li><strong>3. Wybierz kanał</strong><span>Wklej ID kanału, na którym ma działać komenda /suggest.</span></li>
          </ol>
          <p>To jest centralny bot Feedback Forge. Klient nie tworzy aplikacji Discord, nie kopiuje tokenów i nie uruchamia kontenera.</p>
          <div className={isDiscordConnected ? "connectionState connected" : "connectionState"}>
            <strong>{isDiscordConnected ? "Discord połączony" : "Discord niepołączony"}</strong>
            <span>{isDiscordConnected ? "Ten serwer jest przypisany do tego projektu." : "Dodaj naszego bota i zapisz serwer oraz kanał zgłoszeń."}</span>
          </div>
          {inviteUrl ? (
            <a className="primaryButton" href={inviteUrl} target="_blank" rel="noreferrer">
              <ExternalLink size={16} /> Dodaj bota na serwer Discord
            </a>
          ) : (
            <p className="hintBox">Centralny bot nie ma ustawionego DISCORD_CLIENT_ID na serwerze SaaS.</p>
          )}
          <div className="discordFixBox">
            <strong>Widzisz w Discordzie „Integration requires code grant”?</strong>
            <span>W Developer Portal otwórz aplikację bota, przejdź do Bot i wyłącz Requires OAuth2 Code Grant. Zapisz zmiany i kliknij ponownie przycisk dodania bota.</span>
          </div>
          <label>
            ID serwera Discord
            <input value={discordGuildId} onChange={(event) => setDiscordGuildId(event.target.value)} placeholder="np. 987654321098765432" />
          </label>
          <label>
            ID kanału zgłoszeń
            {discordChannels.length ? (
              <select value={discordChannelId} onChange={(event) => setDiscordChannelId(event.target.value)}>
                <option value="">Wybierz kanał</option>
                {discordChannels.map((channel) => (
                  <option key={channel.id} value={channel.id}>#{channel.name}</option>
                ))}
              </select>
            ) : (
              <input value={discordChannelId} onChange={(event) => setDiscordChannelId(event.target.value)} placeholder="np. 123456789012345678" />
            )}
          </label>
          {discordChannelsState ? <p className="hintBox">{discordChannelsState}</p> : null}
          <button className="secondaryButton" onClick={() => void saveDiscord()}><Check size={16} /> Zapisz połączenie Discord</button>
        </article>
        <article className="settingsCard integrationCard">
          <h2><Link2 size={18} /> Web Widget</h2>
          <p>Wklej ten snippet przed `&lt;/body&gt;` na stronie aplikacji lub dokumentacji.</p>
          <div className="codeGroup">
            <span>Snippet HTML</span>
            <code>{widgetSnippet}</code>
          </div>
          <button className="secondaryButton" onClick={() => void copyText(widgetSnippet, "Skopiowano snippet widgetu")}><Copy size={16} /> Kopiuj snippet</button>
        </article>
        <article className="settingsCard integrationCard">
          <h2><GitBranch size={18} /> GitHub Sync</h2>
          <p>Webhook GitHuba powinien wysyłać issue na endpoint importu. Na razie zapisujemy repozytorium do konfiguracji projektu.</p>
          <label>
            Repozytorium
            <input value={githubRepository} onChange={(event) => setGithubRepository(event.target.value)} placeholder="owner/repository" />
          </label>
          <div className="codeGroup">
            <span>Endpoint webhooka GitHub</span>
            <code>{githubWebhookUrl}</code>
          </div>
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
  projectSlug,
  adminKey,
  onProjectSaved
}: {
  project: Project | null;
  session: SessionResponse | null;
  projectSlug: string;
  adminKey?: string;
  onProjectSaved: (project: Project) => void;
}) {
  const { settings, settingsError } = useAdminProjectSettings(projectSlug, adminKey);
  const currentProject = settings?.project ?? project;
  const [name, setName] = useState(currentProject?.name ?? "Orbit Chat");
  const [description, setDescription] = useState(currentProject?.description ?? "");
  const [customDomain, setCustomDomain] = useState(currentProject?.customDomain ?? "");
  const [moderatorDiscordIds, setModeratorDiscordIds] = useState((currentProject?.moderatorDiscordIds ?? []).join(", "));
  const [publicRoadmap, setPublicRoadmap] = useState(currentProject?.publicRoadmap ?? true);
  const [requireLoginToVote, setRequireLoginToVote] = useState(currentProject?.requireLoginToVote ?? false);
  const [requireDiscordAuth, setRequireDiscordAuth] = useState(currentProject?.requireDiscordAuth ?? false);
  const [discordGuildId, setDiscordGuildId] = useState(currentProject?.discordGuildId ?? "");
  const [discordRoleId, setDiscordRoleId] = useState(currentProject?.discordRoleId ?? "");
  const [saveState, setSaveState] = useState<string | null>(null);

  useEffect(() => {
    if (!currentProject) return;
    setName(currentProject.name);
    setDescription(currentProject.description ?? "");
    setCustomDomain(currentProject.customDomain ?? "");
    setModeratorDiscordIds((currentProject.moderatorDiscordIds ?? []).join(", "));
    setPublicRoadmap(currentProject.publicRoadmap ?? true);
    setRequireLoginToVote(currentProject.requireLoginToVote ?? false);
    setRequireDiscordAuth(currentProject.requireDiscordAuth ?? false);
    setDiscordGuildId(currentProject.discordGuildId ?? "");
    setDiscordRoleId(currentProject.discordRoleId ?? "");
  }, [currentProject?.id, currentProject?.updatedAt]);

  const saveSettings = async () => {
    setSaveState("Zapisuję ustawienia...");
    try {
      const result = await updateProjectSettings(
        projectSlug,
        {
          name,
          description,
          customDomain,
          moderatorDiscordIds: moderatorDiscordIds
            .split(",")
            .map((id) => id.trim())
            .filter(Boolean),
          publicRoadmap,
          requireLoginToVote,
          requireDiscordAuth,
          discordGuildId,
          discordRoleId
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
          <p>`Roadmapa publiczna` steruje widocznością w katalogach. Dostęp do samego linku blokuje dopiero wymóg Discorda.</p>
          <label className="toggleRow">
            <input type="checkbox" checked={publicRoadmap} onChange={(event) => setPublicRoadmap(event.target.checked)} />
            Roadmapa publiczna
          </label>
          <label className="toggleRow">
            <input type="checkbox" checked={requireLoginToVote} onChange={(event) => setRequireLoginToVote(event.target.checked)} />
            Wymagaj logowania do głosowania
          </label>
          <label className="toggleRow">
            <input type="checkbox" checked={requireDiscordAuth} onChange={(event) => setRequireDiscordAuth(event.target.checked)} />
            Wymagaj Discorda do oglądania roadmapy
          </label>
          <label>
            Discord Guild ID
            <input value={discordGuildId} onChange={(event) => setDiscordGuildId(event.target.value)} placeholder="ID serwera Discord" />
          </label>
          <label>
            Discord Role ID
            <input value={discordRoleId} onChange={(event) => setDiscordRoleId(event.target.value)} placeholder="Opcjonalnie ID roli Tester/Patron" />
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
