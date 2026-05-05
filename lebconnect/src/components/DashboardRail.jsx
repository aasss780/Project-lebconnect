import {
  AlarmClock,
  Bell,
  Bookmark,
  Building2,
  Calendar,
  Compass,
  Eye,
  Hash,
  Lightbulb,
  Sparkles,
  Target,
  TrendingUp,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

import UserAvatar from "./UserAvatar";
import { dashboardPath, FEED_PATH, getUser } from "../utils/auth";
import { candidateProfileStrength } from "../utils/profileStrength";
import { isDisplayableMediaUrl } from "../utils/profileMedia";

function formatInterviewWhen(scheduledAt) {
  if (!scheduledAt) return { line: "Date TBD", sub: "" };
  const d = new Date(scheduledAt);
  if (Number.isNaN(d.getTime())) return { line: "Date TBD", sub: "" };
  return {
    line: d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    }),
    sub: d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
  };
}

function pickNextInterview(list) {
  const arr = Array.isArray(list) ? list : [];
  const now = Date.now();
  const mapped = arr.map((iv) => ({
    iv,
    t: iv?.scheduledAt ? new Date(iv.scheduledAt).getTime() : NaN,
  }));
  const future = mapped
    .filter((x) => !Number.isNaN(x.t) && x.t >= now - 60_000)
    .sort((a, b) => a.t - b.t);
  if (future.length) return future[0].iv;
  const anyTime = mapped.filter((x) => !Number.isNaN(x.t)).sort((a, b) => b.t - a.t);
  return anyTime.length ? anyTime[0].iv : arr[0] || null;
}

function careerFocusLineToday() {
  const lines = [
    "Lead with measurable impact in screening calls — recruiters anchor on outcomes first.",
    "Refresh your headline monthly so feeds surface the roles you actually want.",
    "Tie each bullet on your CV to a skill recruiters can verify quickly.",
    "Queue two thoughtful questions before every recruiter chat — cadence beats volume.",
    "Batch applications on calmer mornings; quality notes beat spray-and-pray bursts.",
    "Keep your skills list synced with postings you admire — mimic their vocabulary.",
    "Save three target companies weekly and skim their feeds for unstated priorities.",
    "Negotiate timelines in writing once a verbal yes lands — clarity protects everyone.",
  ];
  const daySeed = Math.floor(Date.now() / 86400000);
  return lines[((daySeed % lines.length) + lines.length) % lines.length];
}

function trendingKeywordIdeas(spec) {
  const s = typeof spec === "string" ? spec.trim().toLowerCase() : "";
  const words = s.split(/\s+/).filter((w) => w.length > 2).slice(0, 3);
  const evergreen = ["Remote", "Hybrid", "Contract", "Hiring"];
  return [...new Set([...words, ...evergreen])].slice(0, 4);
}

function RailCard({ title, Icon, children, onClick, interactive }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      className={`lc-glass-card lc-dashboard-rail-inner lc-dashboard-rail-dynamic${
        interactive || onClick ? " lc-dashboard-rail-dynamic--interactive" : ""
      }`}
      onClick={onClick}
    >
      <h4>
        {Icon ? (
          <span className="lc-dashboard-rail-accent" aria-hidden>
            <Icon size={18} strokeWidth={2.25} />
          </span>
        ) : null}
        {title}
      </h4>
      {children}
    </Tag>
  );
}

/** @param {{ label: string; onClick: () => void; variant?: 'primary' | 'ghost' }} props */
function RailCta({ label, onClick, variant = "primary" }) {
  return (
    <button
      type="button"
      className={`lc-dashboard-rail-cta lc-dashboard-rail-cta--${variant} lc-btn-hit`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function EmptyLine({ children }) {
  return (
    <p className="lc-dashboard-rail-dynamic-empty" role="status">
      {children}
    </p>
  );
}

/**
 * Contextual right rail for dashboard & feed.
 *
 * @param {{
 *   variant?: 'default' | 'candidate' | 'feed';
 *   candidateTab?: 'dashboard' | 'findJobs' | 'applications' | 'savedJobs';
 *   context?: Record<string, unknown>;
 * }} props
 */
export default function DashboardRail({
  variant = "default",
  candidateTab = "dashboard",
  context = {},
}) {
  const navigate = useNavigate();
  const session = getUser();
  const role = String(session?.role || "candidate").toLowerCase();

  const defaultStrength = useMemo(
    () => (role === "candidate" ? candidateProfileStrength(session) : null),
    [role, session]
  );

  if (variant === "feed") {
    const {
      people = [],
      companies = [],
      specialization = "",
      followedSet,
      followBusyUserId,
      toggleFollowPerson,
      networkFailed = false,
      onTopicClick,
    } = context;

    const fSet =
      followedSet instanceof Set ? followedSet : new Set(Array.isArray(followedSet) ? followedSet : []);

    return (
      <aside className="lc-dashboard-rail" aria-label="Feed sidebar">
        <RailCard title="People in your field" Icon={Users}>
          <p className="lc-dashboard-rail-dynamic-lead">
            {specialization
              ? `Suggested peers aligned with ${specialization}.`
              : "Add a specialization on your profile to see better matches."}
          </p>
          {networkFailed || !people.length ? (
            <EmptyLine>
              {networkFailed
                ? "Could not load suggestions. Refresh and try again."
                : "No people to show yet."}
            </EmptyLine>
          ) : (
            <ul className="lc-dashboard-rail-dynamic-list">
              {people.slice(0, 3).map((p) => {
                const pid = p.id ?? p._id;
                const name =
                  (typeof p.fullName === "string" && p.fullName.trim()) ||
                  (typeof p.full_name === "string" && p.full_name.trim()) ||
                  "Member";
                const spec =
                  (typeof p.specialization === "string" && p.specialization.trim()) || "";
                const img =
                  typeof p.profileImage === "string"
                    ? p.profileImage.trim()
                    : typeof p.profile_image === "string"
                      ? p.profile_image.trim()
                      : "";
                const following = pid != null && fSet.has(String(pid));
                return (
                  <li key={String(pid)} className="lc-dashboard-rail-dynamic-row">
                    <button
                      type="button"
                      className="lc-dashboard-rail-dynamic-row-main lc-btn-hit"
                      onClick={() => navigate(`/candidate-profile/${pid}`)}
                    >
                      <UserAvatar
                        name={name}
                        src={isDisplayableMediaUrl(img) ? img : undefined}
                        size={36}
                      />
                      <span className="lc-dashboard-rail-dynamic-row-text">
                        <span className="lc-dashboard-rail-dynamic-name">{name}</span>
                        {spec ? (
                          <span className="lc-dashboard-rail-dynamic-sub">{spec}</span>
                        ) : null}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="lc-dashboard-rail-mini-btn lc-btn-hit"
                      disabled={followBusyUserId === Number(pid)}
                      onClick={(e) => toggleFollowPerson?.(e, pid)}
                    >
                      <UserPlus size={14} strokeWidth={2} aria-hidden />
                      {following ? "Following" : "Follow"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </RailCard>

        <RailCard title="Companies hiring" Icon={Building2}>
          <p className="lc-dashboard-rail-dynamic-lead">
            {specialization
              ? `Employers related to your field.`
              : "Employers you may want to follow."}
          </p>
          {!companies.length ? (
            <EmptyLine>No companies matched your profile focus yet.</EmptyLine>
          ) : (
            <ul className="lc-dashboard-rail-dynamic-list">
              {companies.slice(0, 3).map((c) => {
                const cid = c.id ?? c._id;
                const name =
                  (typeof c.company_name === "string" && c.company_name.trim()) ||
                  (typeof c.companyName === "string" && c.companyName.trim()) ||
                  "Company";
                const ind =
                  (typeof c.industry === "string" && c.industry.trim()) || "";
                return (
                  <li key={String(cid)} className="lc-dashboard-rail-dynamic-row">
                    <span className="lc-dashboard-rail-dynamic-row-text">
                      <span className="lc-dashboard-rail-dynamic-name">{name}</span>
                      {ind ? <span className="lc-dashboard-rail-dynamic-sub">{ind}</span> : null}
                    </span>
                    <button
                      type="button"
                      className="lc-dashboard-rail-mini-btn lc-btn-hit"
                      onClick={() => cid && navigate(`/company-profile/${cid}`)}
                    >
                      View
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </RailCard>

        <RailCard title="Trending topics" Icon={Hash}>
          <p className="lc-dashboard-rail-dynamic-lead">Tap to add a hashtag to your post.</p>
          <div className="lc-dashboard-rail-tags">
            {["#Hiring", "#Technology", "#RemoteWork"].map((tag) => (
              <button
                key={tag}
                type="button"
                className="lc-dashboard-rail-tag lc-btn-hit"
                onClick={() => onTopicClick?.(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        </RailCard>
      </aside>
    );
  }

  if (variant === "candidate" && context && typeof context === "object") {
    const {
      uid,
      navigate: nav,
      specialization: specializationRaw = "",
      interviewsMine,
      savedSearchList,
      networkCompanies = [],
      recentViewedJobs = [],
      hasActiveJobFilters,
      allMatchesWeak,
      notifUnread,
      onSaveSearchOpen,
      onScrollSavedSearches,
      onJumpToSavedSearchesBoard,
      onOpenBestMatchJobs,
      onTuneCvRail,
      onTrendingKeyword,
      onOpenRecentJob,
      setCandidateTab,
    } = context;

    const navigateFn = typeof nav === "function" ? nav : navigate;
    const specialization =
      typeof specializationRaw === "string" ? specializationRaw.trim() : "";

    const nextIv = pickNextInterview(interviewsMine);
    const whenIv = nextIv ? formatInterviewWhen(nextIv.scheduledAt) : null;

    const savedSearchArr = Array.isArray(savedSearchList) ? savedSearchList : [];
    const savedSearchCount = savedSearchArr.length;
    const alertSearchCount = savedSearchArr.filter((s) => s && s.alertEnabled).length;

    const companiesRail = Array.isArray(networkCompanies) ? networkCompanies : [];
    const recentJobs = Array.isArray(recentViewedJobs) ? recentViewedJobs : [];

    /** @type {{ title: string; Icon: typeof Target; body: React.ReactNode }[]} */
    let panels = [];

    if (candidateTab === "dashboard") {
      const trendTags = trendingKeywordIdeas(specialization);
      panels = [
        {
          title: "Suggested next steps",
          Icon: Compass,
          body: (
            <>
              <p className="lc-dashboard-rail-dynamic-lead">
                {savedSearchCount
                  ? `${savedSearchCount} saved search${savedSearchCount === 1 ? "" : "es"} on file${
                      alertSearchCount ? ` · ${alertSearchCount} with alerts` : ""
                    }.`
                  : "No saved searches yet — capture filters on Find Jobs to reopen them instantly."}
              </p>
              <RailCta label="Open best-match roles" onClick={() => onOpenBestMatchJobs?.()} />
              <RailCta
                variant="ghost"
                label="Go to saved search board"
                onClick={() => onJumpToSavedSearchesBoard?.()}
              />
              <RailCta variant="ghost" label="Tune CV keywords" onClick={() => onTuneCvRail?.()} />
            </>
          ),
        },
        {
          title: "Match score & daily focus",
          Icon: Lightbulb,
          body: (
            <>
              <p className="lc-dashboard-rail-dynamic-lead">
                Match score weighs your headline, CV, skills, and stated preferences against each role.
              </p>
              {allMatchesWeak ? (
                <p className="lc-dashboard-rail-dynamic-muted">
                  Signals look thin — richer profiles surface stronger fits in results.
                </p>
              ) : (
                <p className="lc-dashboard-rail-dynamic-muted">
                  Keep specialization and skills synced with postings you admire.
                </p>
              )}
              <p className="lc-dashboard-rail-dynamic-muted" style={{ marginTop: 10 }}>
                <strong style={{ color: "var(--text)" }}>Career focus today:</strong> {careerFocusLineToday()}
              </p>
              <RailCta
                label="Refine profile"
                onClick={() => uid && navigateFn(`/candidate-profile/${uid}`)}
              />
            </>
          ),
        },
        {
          title: "Employers & trending searches",
          Icon: TrendingUp,
          body: (
            <>
              {companiesRail.length === 0 ? (
                <EmptyLine>No employer suggestions yet.</EmptyLine>
              ) : (
                <ul className="lc-dashboard-rail-dynamic-list" style={{ marginBottom: 12 }}>
                  {companiesRail.slice(0, 3).map((c) => {
                    const cid = c.id ?? c._id;
                    const name =
                      (typeof c.company_name === "string" && c.company_name.trim()) ||
                      (typeof c.companyName === "string" && c.companyName.trim()) ||
                      "Company";
                    const ind =
                      (typeof c.industry === "string" && c.industry.trim()) || "";
                    return (
                      <li key={String(cid ?? name)} className="lc-dashboard-rail-dynamic-row">
                        <span className="lc-dashboard-rail-dynamic-row-text">
                          <span className="lc-dashboard-rail-dynamic-name">{name}</span>
                          {ind ? <span className="lc-dashboard-rail-dynamic-sub">{ind}</span> : null}
                        </span>
                        <button
                          type="button"
                          className="lc-dashboard-rail-mini-btn lc-btn-hit"
                          onClick={() => cid && navigateFn(`/company-profile/${cid}`)}
                        >
                          View
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="lc-dashboard-rail-dynamic-muted" style={{ marginBottom: 8 }}>
                Quick keyword probes for your finder:
              </p>
              <div className="lc-dashboard-rail-tags">
                {trendTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className="lc-dashboard-rail-tag lc-btn-hit"
                    onClick={() => onTrendingKeyword?.(tag)}
                  >
                    #{String(tag).replace(/^#/, "")}
                  </button>
                ))}
              </div>
            </>
          ),
        },
        {
          title: "Recently viewed roles",
          Icon: Eye,
          body:
            recentJobs.length === 0 ? (
              <>
                <EmptyLine>No roles opened recently this session.</EmptyLine>
                <p className="lc-dashboard-rail-dynamic-muted">
                  Open listings from Recommendations — we keep this recap on-device for privacy.
                </p>
              </>
            ) : (
              <ul className="lc-dashboard-rail-bullet lc-dashboard-rail-bullet--dense">
                {recentJobs.slice(0, 4).map((j) => (
                  <li key={String(j.id)}>
                    <button
                      type="button"
                      className="lc-dashboard-rail-linklike lc-btn-hit"
                      onClick={() => onOpenRecentJob?.(j.id)}
                    >
                      <span className="lc-dashboard-rail-dynamic-name">{j.title}</span>
                      <span className="lc-dashboard-rail-dynamic-muted">{j.company}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ),
        },
        {
          title: "Safety & guidance",
          Icon: Sparkles,
          body: (
            <>
              <p className="lc-dashboard-rail-dynamic-lead">
                Prefer verified employers, capture offers in writing, and report suspicious posts from the contextual
                menu.
              </p>
              {typeof notifUnread === "number" && notifUnread > 0 ? (
                <p className="lc-dashboard-rail-dynamic-muted">
                  Notifications waiting: {notifUnread} unread — skim them alongside application updates.
                </p>
              ) : (
                <p className="lc-dashboard-rail-dynamic-muted">
                  Recruiters often respond in a few working days — nudge politely if silence stretches longer.
                </p>
              )}
            </>
          ),
        },
      ];
    } else if (candidateTab === "findJobs") {
      panels = [
        {
          title: "Saved searches snapshot",
          Icon: Bookmark,
          body: (
            <>
              {savedSearchCount === 0 ? (
                <>
                  <EmptyLine>No saved searches yet.</EmptyLine>
                  <p className="lc-dashboard-rail-dynamic-muted">
                    Save filters on this page; full cards live in the board below.
                  </p>
                </>
              ) : (
                <>
                  <p className="lc-dashboard-rail-dynamic-lead">
                    <strong>{savedSearchCount}</strong> saved preset{savedSearchCount === 1 ? "" : "s"}
                    {alertSearchCount ? ` · ${alertSearchCount} with alerts` : ""}.
                  </p>
                  <p className="lc-dashboard-rail-dynamic-muted">
                    Edit names, keywords, and alerts in the saved search board on this tab.
                  </p>
                </>
              )}
              <RailCta
                label={savedSearchCount ? "Save current search" : "Save this search"}
                onClick={() => onSaveSearchOpen?.()}
              />
              <RailCta
                variant="ghost"
                label="Scroll to saved search board"
                onClick={() => onScrollSavedSearches?.()}
              />
            </>
          ),
        },
        {
          title: "Best match tip",
          Icon: Lightbulb,
          body: (
            <>
              <p className="lc-dashboard-rail-dynamic-lead">
                Match score compares your headline, CV, skills, and preferences to each role.
              </p>
              {allMatchesWeak ? (
                <p className="lc-dashboard-rail-dynamic-muted">
                  Profile signals still look sparse — enriching them lifts every row in this grid.
                </p>
              ) : (
                <p className="lc-dashboard-rail-dynamic-muted">
                  Keep tailoring skills to the postings you heartbeat-save for sharper ordering.
                </p>
              )}
              <RailCta
                label="Complete profile"
                onClick={() => uid && navigateFn(`/candidate-profile/${uid}`)}
              />
            </>
          ),
        },
        {
          title: "Employers near your lens",
          Icon: Building2,
          body:
            companiesRail.length === 0 ? (
              <EmptyLine>Hiring employers aligned to your specialization will populate here soon.</EmptyLine>
            ) : (
              <>
                <p className="lc-dashboard-rail-dynamic-muted" style={{ marginBottom: 10 }}>
                  From your network — company pages, not the job list in the center.
                </p>
                <ul className="lc-dashboard-rail-dynamic-list">
                  {companiesRail.slice(0, 3).map((c) => {
                    const cid = c.id ?? c._id;
                    const name =
                      (typeof c.company_name === "string" && c.company_name.trim()) ||
                      (typeof c.companyName === "string" && c.companyName.trim()) ||
                      "Company";
                    const ind =
                      (typeof c.industry === "string" && c.industry.trim()) || "";
                    return (
                      <li key={String(cid ?? name)} className="lc-dashboard-rail-dynamic-row">
                        <span className="lc-dashboard-rail-dynamic-row-text">
                          <span className="lc-dashboard-rail-dynamic-name">{name}</span>
                          {ind ? <span className="lc-dashboard-rail-dynamic-sub">{ind}</span> : null}
                        </span>
                        <button
                          type="button"
                          className="lc-dashboard-rail-mini-btn lc-btn-hit"
                          onClick={() => cid && navigateFn(`/company-profile/${cid}`)}
                        >
                          Profile
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            ),
        },
      ];
    } else if (candidateTab === "applications") {
      panels = [
        {
          title: "Interview reminder",
          Icon: Calendar,
          body:
            nextIv ? (
              <>
                <p className="lc-dashboard-rail-dynamic-strong">{nextIv.jobTitle || "Interview"}</p>
                <p className="lc-dashboard-rail-dynamic-sub-inline">{nextIv.companyName}</p>
                <p className="lc-dashboard-rail-dynamic-when">
                  <Calendar size={14} strokeWidth={2} aria-hidden />
                  {whenIv.line}
                  {whenIv.sub ? ` · ${whenIv.sub}` : ""}
                </p>
                <RailCta
                  variant="ghost"
                  label="Open dashboard"
                  onClick={() =>
                    typeof setCandidateTab === "function" ? setCandidateTab("dashboard") : undefined
                  }
                />
              </>
            ) : (
              <>
                <EmptyLine>No synced interviews booked yet.</EmptyLine>
                <p className="lc-dashboard-rail-dynamic-muted">
                  Status counts live in the summary row above your list.
                </p>
              </>
            ),
        },
        {
          title: "Application tip",
          Icon: Lightbulb,
          body: (
            <>
              <p className="lc-dashboard-rail-dynamic-lead">
                Lead your note with relevance to their stack, then weave in one standout metric from your last role.
              </p>
              <RailCta
                variant="ghost"
                label="Keep browsing roles"
                onClick={() =>
                  typeof setCandidateTab === "function"
                    ? setCandidateTab("findJobs")
                    : navigateFn(dashboardPath("candidate"), { state: { tab: "findJobs" } })
                }
              />
            </>
          ),
        },
        {
          title: "Inbox cues",
          Icon: Bell,
          body:
            typeof notifUnread === "number" && notifUnread > 0 ? (
              <>
                <p className="lc-dashboard-rail-dynamic-lead">
                  <strong>{notifUnread}</strong> unread notification{notifUnread === 1 ? "" : "s"}.
                </p>
                <RailCta label="Review notifications" onClick={() => navigateFn("/notifications")} />
              </>
            ) : (
              <p className="lc-dashboard-rail-dynamic-lead">
                Silence can mean backlog, not rejection — jot follow-up dates privately so you remain intentional.
              </p>
            ),
        },
      ];
    } else if (candidateTab === "savedJobs") {
      panels = [
        {
          title: "Review cadence",
          Icon: AlarmClock,
          body: (
            <p className="lc-dashboard-rail-dynamic-lead">
              Block twenty minutes weekly to refresh this list — expirations sneak up faster than dashboards announce
              them.
            </p>
          ),
        },
        {
          title: "Advance one role",
          Icon: Zap,
          body: (
            <>
              <p className="lc-dashboard-rail-dynamic-lead">
                Pick the listing with strongest fit and draft a concise note before batches of new roles arrive.
              </p>
              <RailCta
                label={hasActiveJobFilters ? "View filtered finder" : "Open Find Jobs"}
                onClick={() =>
                  typeof setCandidateTab === "function"
                    ? setCandidateTab("findJobs")
                    : navigateFn(dashboardPath("candidate"), { state: { tab: "findJobs" } })
                }
              />
              <RailCta variant="ghost" label="Browse best-match order" onClick={() => onOpenBestMatchJobs?.()} />
            </>
          ),
        },
        {
          title: "Reuse saved presets",
          Icon: Bookmark,
          body: (
            <>
              <p className="lc-dashboard-rail-dynamic-lead">
                Open the saved search board on Find Jobs to reuse named filters.
              </p>
              <RailCta label="Jump to saved search board" onClick={() => onJumpToSavedSearchesBoard?.()} />
            </>
          ),
        },
      ];
    }

    return (
      <aside className="lc-dashboard-rail" aria-label="Candidate sidebar">
        {panels.map((p) => (
          <RailCard key={p.title} title={p.title} Icon={p.Icon}>
            {p.body}
          </RailCard>
        ))}
      </aside>
    );
  }

  /* default: useful shortcuts everywhere else */
  const shortcuts = [];
  if (role === "candidate") {
    shortcuts.push(
      { label: "Find jobs", path: dashboardPath("candidate"), state: { tab: "findJobs" } },
      { label: "Feed", path: FEED_PATH },
      { label: "Messages", path: "/messages" }
    );
  } else if (role === "company") {
    shortcuts.push(
      { label: "Dashboard", path: dashboardPath("company") },
      { label: "Feed", path: FEED_PATH },
      { label: "Messages", path: "/messages" }
    );
  } else {
    shortcuts.push(
      { label: "Dashboard", path: dashboardPath(role) },
      { label: "Feed", path: FEED_PATH },
      { label: "Notifications", path: "/notifications" }
    );
  }

  return (
    <aside className="lc-dashboard-rail" aria-label="Quick shortcuts">
      {defaultStrength ? (
        <RailCard title="Profile strength" Icon={Sparkles}>
          <div className="lc-dashboard-rail-meter">
            <div className="lc-dashboard-rail-meter-bar">
              <div
                className="lc-dashboard-rail-meter-fill"
                style={{ width: `${defaultStrength.pct}%` }}
              />
            </div>
            <strong className="lc-dashboard-rail-meter-label">{defaultStrength.pct}% complete</strong>
          </div>
          {(defaultStrength.checklist || []).length ? (
            <p className="lc-dashboard-rail-dynamic-muted">
              Next: {(defaultStrength.checklist || [])[0]}
            </p>
          ) : null}
          {session?.id ?? session?._id ? (
            <RailCta
              label="Open profile"
              onClick={() => navigate(`/candidate-profile/${session.id ?? session._id}`)}
            />
          ) : null}
        </RailCard>
      ) : null}

      <RailCard title="Shortcuts" Icon={Target}>
        <div className="lc-dashboard-rail-shortcuts">
          {shortcuts.map((s) => (
            <button
              key={s.label}
              type="button"
              className="lc-dashboard-rail-shortcut lc-btn-hit"
              onClick={() => navigate(s.path, { state: s.state })}
            >
              {s.label}
            </button>
          ))}
        </div>
      </RailCard>

      <RailCard title="Alerts" Icon={Bell}>
        <p className="lc-dashboard-rail-dynamic-lead">Stay on top of applications and replies.</p>
        <RailCta variant="ghost" label="Notifications" onClick={() => navigate("/notifications")} />
      </RailCard>
    </aside>
  );
}
