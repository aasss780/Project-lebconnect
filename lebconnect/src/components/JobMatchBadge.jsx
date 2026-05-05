import { calculateJobMatch, computeJobMatchPct, matchScoreTier } from "../utils/jobMatchScore";
import JobMatchExplain from "./JobMatchExplain";

/**
 * @param {{
 *   user: object;
 *   rawJob: object;
 *   className?: string;
 *   showWhy?: boolean;
 *   matchDetail?: object | null;
 *   whyLabel?: "long" | "short";
 *   variant?: "inline" | "modal";
 * }} props
 */
export default function JobMatchBadge({
  user,
  rawJob,
  className = "",
  showWhy = true,
  matchDetail: matchDetailProp = null,
  whyLabel = "long",
  variant = "inline",
}) {
  const pct = computeJobMatchPct(user, rawJob);
  if (pct == null) return null;
  const tier = matchScoreTier(pct);

  const computed = calculateJobMatch(user, rawJob);
  const detail =
    matchDetailProp && typeof matchDetailProp === "object"
      ? { ...computed, ...matchDetailProp, matchExplanation: computed.matchExplanation }
      : computed;

  const ex = detail?.matchExplanation;
  const summaryHint =
    ex && typeof ex.summary === "string" && ex.summary.trim()
      ? ex.summary.trim()
      : "Compared using your specialization, skills, CV text, location, and this job posting.";
  const title = `Match ${pct}% — ${summaryHint}`;

  return (
    <span className={`lc-match-badge-wrap ${className}`.trim()}>
      <span
        className={`lc-match-badge lc-match-badge--${tier}`.trim()}
        title={title}
      >
        Match {pct}%
      </span>
      {showWhy && detail ? (
        <details className={`lc-match-why-details lc-match-why-details--${variant}`}>
          <summary className="lc-match-why-summary">
            {whyLabel === "short" ? "Why?" : "Why this match?"}
          </summary>
          <div className="lc-match-why-body">
            <JobMatchExplain detail={detail} variant={variant} displayScore={pct} />
          </div>
        </details>
      ) : null}
    </span>
  );
}
