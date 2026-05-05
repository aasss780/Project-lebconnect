import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/axios";
import AppTopbar from "../components/AppTopbar";
import AppSidebar from "../components/AppSidebar";
import CandidateSidebar from "../components/CandidateSidebar";
import UserAvatar from "../components/UserAvatar";
import { formatRelativeTime } from "../utils/format";
import { dashboardPath, FEED_PATH, getUser, logout } from "../utils/auth";
import {
  ADMIN_DASHBOARD_PATH,
  ADMIN_MESSAGES_PATH,
  ADMIN_NOTIFICATIONS_PATH,
  adminDashboardPathForTab,
} from "../utils/adminNav";
import { motion } from "framer-motion";

import { lcMotionPage } from "../utils/motionProps";
import "./Dashboard.css";
import "./MessagesPage.css";
import "./CandidateDashboard.css";
import "./AdminDashboard.css";

function idsEqual(a, b) {
  if (a == null || b == null) return false;
  return String(a) === String(b);
}

function partnerLabel(p) {
  if (!p) return "Member";
  return p.companyName || p.fullName || p.email || "Member";
}

function partnerIdObj(p) {
  return p?.id ?? p?._id ?? null;
}

/** Map profile GET body + route id (API omits numeric id on public profile payloads). */
function mapPeekToPartner(peek, rawId) {
  const nid = Number(rawId);
  const pid = Number.isFinite(nid) ? nid : rawId;
  if (!peek) {
    return {
      id: pid,
      fullName: "User",
      companyName: null,
      email: "",
      role: null,
      profileImage: null,
      logo: null,
    };
  }
  if (peek.profileType === "company") {
    return {
      id: pid,
      companyName: peek.companyName,
      fullName: null,
      email: "",
      role: "company",
      profileImage: null,
      logo: peek.logo,
    };
  }
  return {
    id: pid,
    fullName: peek.fullName,
    companyName: null,
    email: "",
    role: "candidate",
    profileImage: peek.profileImage,
    logo: null,
  };
}

function MessagesInner() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const me = getUser();
  const meId = me?.id ?? me?._id;
  const role = me?.role;

  useEffect(() => {
    if (role === "admin" && location.pathname === "/admin/messages") {
      navigate(`${ADMIN_MESSAGES_PATH}${location.search || ""}`, { replace: true });
    }
  }, [role, location.pathname, location.search, navigate]);

  const [conversations, setConversations] = useState([]);
  const [peekPartner, setPeekPartner] = useState(null);
  const [peekLoading, setPeekLoading] = useState(false);

  const [selectedPartnerId, setSelectedPartnerId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");

  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const [sendError, setSendError] = useState("");
  const [topSearch, setTopSearch] = useState("");
  const [notifUnread, setNotifUnread] = useState(0);
  const [msgUnreadTotal, setMsgUnreadTotal] = useState(0);

  const paramUserId = searchParams.get("userId");

  /** /messages?admin=true → replace with userId from GET /api/users/admin */
  useEffect(() => {
    if (role === "admin") return;
    const sp = new URLSearchParams(location.search);
    if (sp.get("admin") !== "true") return;

    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get("/api/users/admin");
        if (cancelled || data?.id == null) return;
        sp.delete("admin");
        sp.set("userId", String(data.id));
        const q = sp.toString();
        navigate({ pathname: location.pathname, search: q ? `?${q}` : "" }, { replace: true });
      } catch {
        /* keep URL; user can retry */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [location.pathname, location.search, role, navigate]);

  const loadConversations = useCallback(async () => {
    setListLoading(true);
    setListError("");
    try {
      const { data } = await api.get("/api/messages/conversations");
      const list = Array.isArray(data) ? data : [];
      setConversations(list);
      setMsgUnreadTotal(
        list.reduce((acc, row) => acc + Number(row.unread || 0), 0)
      );
    } catch (e) {
      setListError(
        e.response?.data?.message ||
          e.message ||
          "Could not load conversations."
      );
      setConversations([]);
      setMsgUnreadTotal(0);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get("/api/notifications");
        if (!cancelled) {
          const list = Array.isArray(data) ? data : [];
          setNotifUnread(list.filter((n) => !n.isRead).length);
        }
      } catch {
        if (!cancelled) setNotifUnread(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!paramUserId) {
      setPeekPartner(null);
      return;
    }
    let cancelled = false;
    setPeekLoading(true);
    (async () => {
      try {
        const { data } = await api.get(`/api/users/profile/${paramUserId}`);
        if (cancelled) return;
        setPeekPartner(mapPeekToPartner(data, paramUserId));
      } catch {
        if (cancelled) return;
        try {
          const { data: adm } = await api.get("/api/users/admin");
          if (
            cancelled ||
            adm == null ||
            Number(adm.id) !== Number(paramUserId)
          ) {
            setPeekPartner(mapPeekToPartner(null, paramUserId));
          } else {
            setPeekPartner({
              id: adm.id,
              _id: adm.id,
              fullName: adm.fullName || "Support",
              companyName: adm.companyName || null,
              email: adm.email || "",
              role: "admin",
              profileImage: null,
              logo: null,
            });
          }
        } catch {
          if (!cancelled) setPeekPartner(mapPeekToPartner(null, paramUserId));
        }
      } finally {
        if (!cancelled) setPeekLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [paramUserId]);

  /** Open chat from URL param once conversations / peek settled */
  useEffect(() => {
    if (!paramUserId || peekLoading) return;
    const pid = Number(paramUserId);
    const idNorm = Number.isFinite(pid) ? pid : paramUserId;
    setSelectedPartnerId(idNorm);
  }, [paramUserId, peekLoading]);

  const mergedConversationRows = useMemo(() => {
    const rows = [...conversations];
    if (
      peekPartner &&
      partnerIdObj(peekPartner) != null &&
      !rows.some((c) => idsEqual(partnerIdObj(c.partner), partnerIdObj(peekPartner)))
    ) {
      rows.unshift({
        partner: peekPartner,
        lastMessage: null,
        unread: 0,
      });
    }
    return rows;
  }, [conversations, peekPartner]);

  const loadThread = useCallback(async (otherId) => {
    if (otherId == null || otherId === "") return;
    setChatLoading(true);
    setChatError("");
    try {
      const { data } = await api.get(`/api/messages/${otherId}`);
      setMessages(Array.isArray(data) ? data : []);
      await loadConversations();
    } catch (e) {
      setChatError(
        e.response?.data?.message ||
          e.message ||
          "Could not load this conversation."
      );
      setMessages([]);
    } finally {
      setChatLoading(false);
    }
  }, [loadConversations]);

  useEffect(() => {
    if (selectedPartnerId == null || selectedPartnerId === "") return;
    loadThread(selectedPartnerId);
  }, [selectedPartnerId, loadThread]);

  const selectedPartnerResolved = useMemo(() => {
    if (selectedPartnerId == null) return null;
    const row = mergedConversationRows.find((c) =>
      idsEqual(partnerIdObj(c.partner), selectedPartnerId)
    );
    return row?.partner || peekPartner;
  }, [mergedConversationRows, selectedPartnerId, peekPartner]);

  const spec = me?.specialization || "";

  const signOut = () => {
    logout();
    navigate("/login");
  };

  const goRoleHome = () => {
    if (role) navigate(dashboardPath(role));
    else navigate("/");
  };

  const handleTopSearchKeyDown = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const q = topSearch.trim();
    if (!q) {
      goRoleHome();
      return;
    }
    if (role === "candidate") {
      navigate("/candidate-dashboard", { state: { tab: "findJobs", q } });
      return;
    }
    if (role) {
      navigate(`${dashboardPath(role)}?q=${encodeURIComponent(q)}`);
      return;
    }
    navigate(`/?q=${encodeURIComponent(q)}`);
  };

  const selectConversation = (pid) => {
    setSendError("");
    setSelectedPartnerId(pid);
    const next = new URLSearchParams(searchParams);
    next.set("userId", String(pid));
    setSearchParams(next, { replace: true });
  };

  /** Backend accepts `receiver` (numeric); also send receiverId for forward compatibility */
  const sendMessageNow = async () => {
    const text = draft.trim();
    if (!selectedPartnerId || !text) return;
    setSendError("");
    const receiverNum = Number(selectedPartnerId);
    if (!Number.isFinite(receiverNum)) {
      setSendError("Invalid recipient.");
      return;
    }

    try {
      const { data } = await api.post("/api/messages", {
        receiver: receiverNum,
        receiverId: receiverNum,
        text,
      });
      setDraft("");

      const created = data?.message;
      if (created && typeof created === "object" && created.text) {
        setMessages((prev) => [...prev, created]);
      } else {
        await loadThread(selectedPartnerId);
      }
      await loadConversations();
    } catch (e) {
      setSendError(
        e.response?.data?.message ||
          e.message ||
          "Message could not be sent."
      );
    }
  };

  const messagesPanel = (
    <main
      className={`msg-main-area ${role === "admin" ? "main-content adm-main" : "main-content"}`}
    >
      {listError ? (
        <div className="msg-banner msg-banner--error">{listError}</div>
      ) : null}

      <div className="msg-shell">
        <aside className="msg-convos">
          <div className="msg-convos-head">
            <h2>Messages</h2>
          </div>
          <div className="msg-convos-list">
            {listLoading ? (
              <p className="msg-muted pad">Loading conversations…</p>
            ) : null}
            {!listLoading &&
            mergedConversationRows.length === 0 &&
            !paramUserId ? (
              <div className="msg-empty-card">
                <h3>No messages yet</h3>
                <p>When you message someone from a profile, it will appear here.</p>
              </div>
            ) : null}
            {!listLoading &&
              mergedConversationRows.map((row) => {
                const p = row.partner;
                const pid = partnerIdObj(p);
                const active = idsEqual(pid, selectedPartnerId);
                const lm = row.lastMessage;
                const preview = lm?.text || "Start the conversation…";
                const timeStr = lm?.createdAt
                  ? formatRelativeTime(lm.createdAt)
                  : "";
                const unread = Number(row.unread || 0);

                return (
                  <button
                    key={`${pid}`}
                    type="button"
                    className={`msg-convo-row ${active ? "msg-convo-row--active" : ""}`}
                    onClick={() => selectConversation(pid)}
                  >
                    <UserAvatar user={p} size={44} />
                    <div className="msg-convo-body">
                      <div className="msg-convo-top">
                        <span className="msg-convo-name">{partnerLabel(p)}</span>
                        {timeStr ? (
                          <span className="msg-convo-time">{timeStr}</span>
                        ) : null}
                      </div>
                      <div className="msg-convo-preview">{preview}</div>
                    </div>
                    {unread > 0 ? (
                      <span className="msg-unread-pill">{unread}</span>
                    ) : null}
                  </button>
                );
              })}
          </div>
        </aside>

        <section className="msg-chat">
          {!selectedPartnerId ? (
            <div className="msg-chat-placeholder">
              <h3>Select a conversation to start messaging</h3>
              <p>Choose someone from the left, or open a chat from their profile.</p>
            </div>
          ) : (
            <>
              <header className="msg-chat-head">
                <UserAvatar user={selectedPartnerResolved} size={44} />
                <div>
                  <h3>{partnerLabel(selectedPartnerResolved)}</h3>
                  <p className="msg-muted small">
                    {selectedPartnerResolved?.role === "company"
                      ? "Company"
                      : selectedPartnerResolved?.role === "admin"
                        ? "Administrator"
                        : selectedPartnerResolved?.role === "candidate"
                          ? "Candidate"
                          : "Member"}
                  </p>
                </div>
              </header>

              {chatError ? (
                <div className="msg-banner msg-banner--error msg-banner--narrow">
                  {chatError}
                </div>
              ) : null}

              <div className="msg-scroll">
                {chatLoading ? (
                  <p className="msg-muted pad center">Loading messages…</p>
                ) : null}
                {!chatLoading &&
                messages.filter(Boolean).length === 0 &&
                !chatError ? (
                  <p className="msg-muted pad center">No messages yet. Say hello.</p>
                ) : null}
                {!chatLoading &&
                  messages.map((m) => {
                    const sid = partnerIdObj(m.sender);
                    const mine = idsEqual(sid, meId);
                    return (
                      <div
                        key={m._id ?? m.id ?? `${sid}-${m.createdAt}-${m.text?.slice?.(0, 8)}`}
                        className={`msg-bubble-wrap ${mine ? "msg-bubble-wrap--mine" : ""}`}
                      >
                        <div
                          className={`msg-bubble ${mine ? "msg-bubble--mine" : "msg-bubble--theirs"}`}
                        >
                          {m.text}
                        </div>
                        <span className="msg-bubble-meta">
                          {formatRelativeTime(m.createdAt)}
                        </span>
                      </div>
                    );
                  })}
              </div>

              <footer className="msg-composer">
                {sendError ? (
                  <div className="msg-send-err">{sendError}</div>
                ) : null}
                <div className="msg-composer-row">
                  <input
                    type="text"
                    className="msg-input"
                    placeholder="Write a message…"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessageNow();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="msg-send-btn"
                    disabled={!draft.trim()}
                    onClick={sendMessageNow}
                  >
                    Send
                  </button>
                </div>
              </footer>
            </>
          )}
        </section>
      </div>
    </main>
  );

  /** ---- Candidate layout ---- */
  if (role === "candidate") {
    return (
      <motion.div className="candidate-page" {...lcMotionPage()}>
        <AppTopbar
          user={me}
          searchPlaceholder="Search jobs, companies..."
          searchValue={topSearch}
          onSearchChange={(e) => setTopSearch(e.target.value)}
          onSearchKeyDown={handleTopSearchKeyDown}
          notifUnread={notifUnread}
          messagesUnread={msgUnreadTotal}
          onLogoClick={goRoleHome}
          onHomeClick={goRoleHome}
          onMessagesClick={() => navigate("/messages")}
          onNotificationsClick={() => navigate("/notifications")}
          subtitle={spec || "Candidate"}
        />

        <div className="dashboard-body">
          <CandidateSidebar
            user={me}
            activeKey="messages"
            notifUnread={notifUnread}
            messagesUnread={msgUnreadTotal}
            onDashboard={() =>
              navigate("/candidate-dashboard", { state: { tab: "dashboard" } })
            }
            onFeed={() => navigate(FEED_PATH)}
            onFindJobs={() =>
              navigate("/candidate-dashboard", { state: { tab: "findJobs" } })
            }
            onApplications={() =>
              navigate("/candidate-dashboard", { state: { tab: "applications" } })
            }
            onSavedJobs={() =>
              navigate("/candidate-dashboard", { state: { tab: "savedJobs" } })
            }
            onMessages={() => navigate("/messages")}
            onNotifications={() => navigate("/notifications")}
            onMyProfile={() => {
              const uid = me?.id ?? me?._id;
              if (uid) navigate(`/candidate-profile/${uid}`);
            }}
            onSignOut={signOut}
          />
          {messagesPanel}
        </div>
      </motion.div>
    );
  }

  /** ---- Company layout ---- */
  if (role === "company") {
    return (
      <motion.div className="candidate-page" {...lcMotionPage()}>
        <AppTopbar
          user={me}
          searchPlaceholder="Search jobs, companies..."
          searchValue={topSearch}
          onSearchChange={(e) => setTopSearch(e.target.value)}
          onSearchKeyDown={handleTopSearchKeyDown}
          notifUnread={notifUnread}
          messagesUnread={msgUnreadTotal}
          onLogoClick={goRoleHome}
          onHomeClick={goRoleHome}
          onMessagesClick={() => navigate("/messages")}
          onNotificationsClick={() => navigate("/notifications")}
          subtitle="Company"
        />

        <div className="dashboard-body">
          <CandidateSidebar
            variant="company"
            user={me}
            activeKey="messages"
            notifUnread={notifUnread}
            messagesUnread={msgUnreadTotal}
            onDashboard={() =>
              navigate("/company-dashboard", { state: { tab: "dashboard" } })
            }
            onFeed={() => navigate(FEED_PATH)}
            onMyJobs={() =>
              navigate("/company-dashboard", { state: { tab: "jobs" } })
            }
            onApplicants={() =>
              navigate("/company-dashboard", { state: { tab: "applicants" } })
            }
            onMessages={() => navigate("/messages")}
            onNotifications={() => navigate("/notifications")}
            onMyProfile={() => {
              const uid = me?.id ?? me?._id;
              if (uid) navigate(`/company-profile/${uid}`);
            }}
            onFindJobs={() => {}}
            onApplications={() => {}}
            onSavedJobs={() => {}}
            onSignOut={signOut}
          />
          {messagesPanel}
        </div>
      </motion.div>
    );
  }

  /** ---- Admin layout ---- */
  if (role === "admin") {
    const goDash = () => navigate(ADMIN_DASHBOARD_PATH);

    return (
      <motion.div className="candidate-page admin-app-page" {...lcMotionPage()}>
        <AppTopbar
          user={me}
          subtitle="Administrator"
          searchPlaceholder="Search jobs, companies…"
          searchValue={topSearch}
          onSearchChange={(e) => setTopSearch(e.target.value)}
          onSearchKeyDown={handleTopSearchKeyDown}
          notifUnread={notifUnread}
          messagesUnread={msgUnreadTotal}
          showMessaging
          onLogoClick={goDash}
          onHomeClick={goDash}
          onMessagesClick={() => navigate(ADMIN_MESSAGES_PATH)}
          onNotificationsClick={() => navigate(ADMIN_NOTIFICATIONS_PATH)}
        />

        <div className="dashboard-body">
          <AppSidebar
            user={me}
            activeSection="messages"
            notifUnread={notifUnread}
            messagesUnread={msgUnreadTotal}
            onDashboard={goDash}
            onUsers={() => navigate(adminDashboardPathForTab("users"))}
            onJobs={() => navigate(adminDashboardPathForTab("jobs"))}
            onComplaints={() => navigate(adminDashboardPathForTab("complaints"))}
            onModeration={() => navigate(adminDashboardPathForTab("moderation"))}
            onMessages={() => navigate(ADMIN_MESSAGES_PATH)}
            onNotifications={() => navigate(ADMIN_NOTIFICATIONS_PATH)}
            onSignOut={signOut}
          />
          {messagesPanel}
        </div>
      </motion.div>
    );
  }

  /** Fallback authenticated role */
  return (
    <div className="messages-page-msg-fallback">{messagesPanel}</div>
  );
}

export default function MessagesPage() {
  return <MessagesInner />;
}
