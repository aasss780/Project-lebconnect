const PIPELINE = ["applied", "viewed", "shortlisted", "interview"];

/**
 * @param {{ stage?: string, status?: string }} props
 */
export default function ApplicationPipeline({ stage, status }) {
  const st = String(status || "").toLowerCase();
  const sg = String(stage || "applied").toLowerCase();

  const labels = [...PIPELINE];
  if (st === "accepted" || st === "rejected") labels.push(st);

  const currentKey =
    st === "accepted" || st === "rejected" ? st : PIPELINE.includes(sg) ? sg : "applied";

  return (
    <div className="lc-app-pipeline" role="group" aria-label="Application timeline">
      {labels.map((key) => (
        <div
          key={key}
          className={`lc-app-pipeline-step ${
            currentKey === key ? "lc-app-pipeline-step--current" : ""
          } lc-app-pipeline-step--${key} ${
            key === "accepted"
              ? "lc-app-pipeline-step--good"
              : key === "rejected"
                ? "lc-app-pipeline-step--bad"
                : ""
          }`}
        >
          <span className="lc-app-pipeline-dot" />
          <span className="lc-app-pipeline-label">
            {key.charAt(0).toUpperCase() + key.slice(1)}
          </span>
        </div>
      ))}
    </div>
  );
}
