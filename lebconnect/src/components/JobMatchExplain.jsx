import { AlertTriangle, CheckCircle2, Sparkles } from "lucide-react";

function safeStr(v) {
  if (v == null || v === "") return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  const s = String(v).trim();
  return s === "undefined" || s === "null" ? "" : s;
}

function legacyExplanation(detail) {
  const score = Math.round(Number(detail?.matchScore ?? detail?.score ?? 0)) || 0;
  const field = safeStr(detail?.fieldMatchText);
  const skills = Array.isArray(detail?.matchedSkills)
    ? detail.matchedSkills.map(safeStr).filter(Boolean)
    : [];
  const loc = safeStr(detail?.locationMatchText);
  const cvKw = [
    ...(Array.isArray(detail?.cvSnippets) ? detail.cvSnippets : []).map(safeStr).filter(Boolean),
  ];
  const jt = safeStr(detail?.jobTypeMatchText);
  const missSkills = Array.isArray(detail?.missingSkills)
    ? detail.missingSkills.map(safeStr).filter(Boolean)
    : [];
  const pm = Array.isArray(detail?.profileMissing) ? detail.profileMissing.map(safeStr).filter(Boolean) : [];
  const items = [];
  if (pm.some((p) => /CV|cv/i.test(p))) items.push("CV");
  if (pm.some((p) => /location/i.test(p))) items.push("Location");
  if (pm.some((p) => /skill/i.test(p))) items.push("Skills");
  if (pm.some((p) => /field|specialization/i.test(p))) items.push("Field");
  const tips = [];
  if (items.includes("CV")) tips.push("Upload your CV to improve match accuracy.");
  if (items.includes("Location")) tips.push("Add your location to improve location matching.");
  if (items.includes("Skills")) tips.push("Add skills to your profile to improve results.");
  if (detail?.insufficientData) tips.push("Complete your profile for a more reliable match score.");
  return {
    score,
    summary:
      score >= 60
        ? "Good match for your profile based on saved details."
        : score >= 40
          ? "Fair match — more profile detail would sharpen this score."
          : "Limited overlap with this posting so far.",
    matched: {
      field: field || null,
      skills,
      location: loc || null,
      cvKeywords: cvKw.slice(0, 8),
      jobType: jt || null,
    },
    missing: { skills: missSkills, profileItems: [...new Set(items)] },
    tips: [...new Set(tips)],
  };
}

/**
 * “Why this job matches you” — uses `matchExplanation` from `calculateJobMatch`.
 *
 * @param {{ detail: Record<string, unknown>|null; variant?: "inline" | "modal"; displayScore?: number|null }} props
 */
export default function JobMatchExplain({ detail, variant = "inline", displayScore = null }) {
  if (!detail || typeof detail !== "object") return null;

  const ex =
    detail.matchExplanation && typeof detail.matchExplanation === "object"
      ? detail.matchExplanation
      : legacyExplanation(detail);

  const scoreRaw = displayScore != null && Number.isFinite(displayScore) ? displayScore : ex.score;
  const score = Math.max(0, Math.min(100, Math.round(Number(scoreRaw) || 0)));
  const summary = safeStr(ex.summary) || "Here is how this job lines up with your profile.";

  const m = ex.matched && typeof ex.matched === "object" ? ex.matched : {};
  const field = m.field != null ? safeStr(m.field) : "";
  const skills = Array.isArray(m.skills) ? m.skills.map(safeStr).filter(Boolean) : [];
  const loc = m.location != null ? safeStr(m.location) : "";
  const cvKeywords = Array.isArray(m.cvKeywords) ? m.cvKeywords.map(safeStr).filter(Boolean) : [];
  const jobType = m.jobType != null ? safeStr(m.jobType) : "";

  const miss = ex.missing && typeof ex.missing === "object" ? ex.missing : {};
  const missSkills = Array.isArray(miss.skills) ? miss.skills.map(safeStr).filter(Boolean) : [];
  const profileItems = Array.isArray(miss.profileItems)
    ? miss.profileItems.map(safeStr).filter(Boolean)
    : [];

  const tips = Array.isArray(ex.tips) ? ex.tips.map(safeStr).filter(Boolean) : [];
  const insufficient = Boolean(detail.insufficientData);
  const profileMissing = Array.isArray(detail.profileMissing)
    ? detail.profileMissing.map(safeStr).filter(Boolean)
    : [];
  const tipLines = [...new Set([...tips, ...(insufficient ? profileMissing : [])])].filter(Boolean);

  const anyMatched = Boolean(
    field || skills.length || loc || cvKeywords.length || jobType
  );

  const wrapClass =
    variant === "modal"
      ? "lc-match-explain-v2 lc-match-explain-v2--modal"
      : "lc-match-explain-v2 lc-match-explain-v2--inline";

  const MatchedRow = ({ children }) => (
    <li className="lc-match-explain-v2-li lc-match-explain-v2-li--ok">
      <CheckCircle2 size={16} strokeWidth={2.25} className="lc-match-explain-v2-ico" aria-hidden />
      <span>{children}</span>
    </li>
  );

  const ChipList = ({ items, tone = "ok" }) => (
    <span className="lc-match-explain-v2-chip-row">
      {items.map((item) => (
        <span key={`${tone}-${item}`} className={`lc-match-explain-v2-chip lc-match-explain-v2-chip--${tone}`}>
          {item}
        </span>
      ))}
    </span>
  );

  const WarnRow = ({ children }) => (
    <li className="lc-match-explain-v2-li lc-match-explain-v2-li--warn">
      <AlertTriangle size={16} strokeWidth={2.25} className="lc-match-explain-v2-ico" aria-hidden />
      <span>{children}</span>
    </li>
  );

  return (
    <div className={wrapClass}>
      <h4 className="lc-match-explain-v2-title">Why this job matches you</h4>

      <div className="lc-match-explain-v2-score-wrap">
        <span className="lc-match-explain-v2-score">Match {score}%</span>
      </div>

      <div className="lc-match-explain-v2-block">
        <p className="lc-match-explain-v2-block-title">Why it matches</p>
        <p className="lc-match-explain-v2-summary">{summary}</p>
      </div>

      <div className="lc-match-explain-v2-block">
        <p className="lc-match-explain-v2-block-title">Strong points</p>
        <ul className="lc-match-explain-v2-ul">
          {!anyMatched ? (
            <li className="lc-match-explain-v2-li lc-match-explain-v2-li--muted">
              No strong overlaps yet in field, skills, location, or CV keywords.
            </li>
          ) : null}
          {field ? <MatchedRow>Strong match in: {field}</MatchedRow> : null}
          {skills.length ? (
            <MatchedRow>
              Matching skills:
              <ChipList items={skills.slice(0, 8)} tone="ok" />
            </MatchedRow>
          ) : anyMatched ? (
            <li className="lc-match-explain-v2-li lc-match-explain-v2-li--muted">
              No exact skill matches found yet.
            </li>
          ) : null}
          {loc ? <MatchedRow>Location alignment: {loc}</MatchedRow> : null}
          {cvKeywords.length ? (
            <MatchedRow>
              Matching keywords from CV/profile:
              <ChipList items={cvKeywords.slice(0, 8)} tone="info" />
            </MatchedRow>
          ) : null}
          {jobType ? <MatchedRow>Role type fit: {jobType}</MatchedRow> : null}
        </ul>
      </div>

      <div className="lc-match-explain-v2-block">
        <p className="lc-match-explain-v2-block-title">Missing points</p>
        <ul className="lc-match-explain-v2-ul">
          {missSkills.length ? (
            <WarnRow>
              Add missing skills:
              <ChipList items={missSkills.slice(0, 8)} tone="warn" />
            </WarnRow>
          ) : (
            <li className="lc-match-explain-v2-li lc-match-explain-v2-li--muted">
              No major missing skills detected.
            </li>
          )}
          {profileItems.length ? (
            <WarnRow>Profile: add {profileItems.join(", ")}</WarnRow>
          ) : null}
        </ul>
      </div>

      {tipLines.length ? (
        <div className="lc-match-explain-v2-block">
          <p className="lc-match-explain-v2-block-title">
            <Sparkles
              size={14}
              strokeWidth={2}
              aria-hidden
              style={{ display: "inline", verticalAlign: "text-top", marginRight: 4 }}
            />
            Suggestions to improve
          </p>
          <ul className="lc-match-explain-v2-ul">
            {tipLines.map((t) => (
              <WarnRow key={t}>{t}</WarnRow>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
