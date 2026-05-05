import { useCallback, useEffect, useState } from "react";
import { FileSearch, Loader2, Trash2 } from "lucide-react";
import api from "../api/axios";
import { useToast } from "../context/ToastContext";
import "./CvKeywordAnalysisCard.css";

const LS_KEY = (uid) => `lc_cv_kw_v1_${uid}`;

function unwrapSavedEnvelope(rawSaved) {
  if (!rawSaved || typeof rawSaved !== "object") return { result: null, meta: null };
  if ("result" in rawSaved && rawSaved.result && typeof rawSaved.result === "object") {
    return { result: rawSaved.result, meta: rawSaved.meta || null };
  }
  return { result: rawSaved, meta: null };
}

/**
 * Rule-based CV keyword scan (not AI). Optional `onResultChange` for job match integration.
 */
export default function CvKeywordAnalysisCard({
  userId,
  hasCvFile,
  cvFingerprint = "",
  onResultChange,
  onGoUploadCv,
  className = "",
}) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState(null);
  /** Fingerprint from last saved server analysis (for CV-changed hint) */
  const [savedFingerprint, setSavedFingerprint] = useState(null);

  const persistAndNotify = useCallback(
    (data, metaFp) => {
      setResult(data);
      onResultChange?.(data);
      if (metaFp != null) setSavedFingerprint(metaFp);
      if (userId && data) {
        try {
          localStorage.setItem(LS_KEY(userId), JSON.stringify({ version: 1, payload: data }));
        } catch {
          /* quota */
        }
      }
    },
    [onResultChange, userId]
  );

  const hydrateFromLocal = useCallback(() => {
    if (!userId) return;
    try {
      const raw = localStorage.getItem(LS_KEY(userId));
      if (!raw) return;
      const p = JSON.parse(raw);
      if (p && p.version === 1 && p.payload && typeof p.payload === "object") {
        setResult(p.payload);
        onResultChange?.(p.payload);
      }
    } catch {
      /* ignore */
    }
  }, [userId, onResultChange]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get("/api/cv/analysis/my");
        if (cancelled) return;
        const savedRaw = data?.saved;
        const { result: r, meta } = unwrapSavedEnvelope(savedRaw);
        if (r && typeof r === "object") {
          setResult(r);
          onResultChange?.(r);
          const fp = meta?.fingerprint != null ? String(meta.fingerprint) : null;
          setSavedFingerprint(fp);
          return;
        }
      } catch {
        /* fallback local */
      }
      if (!cancelled) hydrateFromLocal();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per userId
  }, [userId]);

  const runAnalyze = async () => {
    if (!userId) {
      toast.error("Sign in again to analyze your CV.");
      return;
    }
    setErr("");
    setLoading(true);
    try {
      const { data: prof } = await api.get(`/api/users/profile/${userId}`);
      const cv = typeof prof?.candidateCv === "string" ? prof.candidateCv.trim() : "";
      const fn = String(prof?.candidateCvFileName || "").trim();

      const { data } = await api.post("/api/cv/analyze", {
        ...(cv ? { cv, fileName: fn || "profile-cv" } : { fileName: "profile-only" }),
      });

      const hadPrior = Boolean(result);
      const byteLen = cv ? new TextEncoder().encode(cv).length : 0;
      persistAndNotify(data, `${byteLen}|${fn}`);
      toast.success(hadPrior ? "CV re-analyzed." : "CV Keyword Analysis ready.");
    } catch (e) {
      console.error("[CV Keyword Analysis]", e);
      const msg = e.response?.data?.message || e.message || "Analysis failed.";
      setErr(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const clearAnalysis = async () => {
    if (!userId) return;
    setErr("");
    try {
      await api.delete("/api/cv/analysis/my");
    } catch {
      /* still clear UI */
    }
    setResult(null);
    setSavedFingerprint(null);
    onResultChange?.(null);
    try {
      localStorage.removeItem(LS_KEY(userId));
    } catch {
      /* */
    }
    toast.success("Analysis cleared.");
  };

  const cvMismatch =
    Boolean(cvFingerprint && savedFingerprint) && cvFingerprint !== savedFingerprint;

  const lim = Boolean(result?.extractionLimited);
  const conf =
    typeof result?.fieldConfidence === "number" && Number.isFinite(result.fieldConfidence)
      ? result.fieldConfidence
      : null;

  return (
    <div className={`lc-cva-card ${className}`.trim()}>
      <h3 className="lc-cva-title">CV Keyword Analysis</h3>
      <p className="lc-cva-sub">
        Based on extracted CV text and profile keywords. This is a simple, rule-based scan — not
        AI.
      </p>

      {!hasCvFile ? (
        <div className="lc-cva-upload-prompt">
          <p className="lc-cva-warn lc-cva-warn--neutral">
            Upload your CV to start analysis.
          </p>
          <p className="lc-cva-empty-hint lc-cva-empty-hint--tight">
            Upload or analyze your CV to see keyword insights.
          </p>
          {typeof onGoUploadCv === "function" ? (
            <button type="button" className="lc-cva-btn lc-cva-btn--secondary" onClick={onGoUploadCv}>
              Upload CV
            </button>
          ) : null}
        </div>
      ) : null}

      {hasCvFile && !loading && !result ? (
        <p className="lc-cva-empty-hint">
          Analyze your CV below to extract keyword insights.
        </p>
      ) : null}

      {cvMismatch ? (
        <p className="lc-cva-warn" role="status">
          Your CV changed. Re-analyze to update insights.
        </p>
      ) : null}

      <div className="lc-cva-actions lc-cva-actions--row">
        <button
          type="button"
          className="lc-cva-btn"
          disabled={loading || !hasCvFile}
          onClick={() => void runAnalyze()}
        >
          {loading ? (
            <>
              <Loader2 size={16} className="lc-spin" strokeWidth={2} aria-hidden />
              Analyzing…
            </>
          ) : (
            <>
              <FileSearch size={16} strokeWidth={2} aria-hidden />
              {result ? "Re-analyze CV" : "Analyze CV"}
            </>
          )}
        </button>
        {result && !loading ? (
          <button type="button" className="lc-cva-btn lc-cva-btn--ghost" onClick={() => void clearAnalysis()}>
            <Trash2 size={16} strokeWidth={2} aria-hidden />
            Clear analysis
          </button>
        ) : null}
      </div>

      {err ? <p className="lc-cva-err">{err}</p> : null}

      {lim && result?.message ? (
        <div className="lc-cva-warn" role="status">
          <strong>Limited extraction.</strong> {result.message}
        </div>
      ) : null}

      {result && !loading ? (
        <>
          <div className="lc-cva-section">
            <h4>Detected field</h4>
            <div className="lc-cva-field-row">
              <span className="lc-cva-chip lc-cva-chip--field">
                {result.primaryField || "General"}
              </span>
              {conf != null ? (
                <span className="lc-cva-confidence">Confidence ~{conf}% (heuristic)</span>
              ) : null}
            </div>
          </div>

          {(result.detectedIndustries || []).length ? (
            <div className="lc-cva-section">
              <h4>Detected industries</h4>
              <div className="lc-cva-chips">
                {(result.detectedIndustries || []).map((x) => (
                  <span key={x} className="lc-cva-badge">
                    {x}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div className="lc-cva-section">
            <h4>Detected skills</h4>
            {(result.detectedSkills || []).length ? (
              <div className="lc-cva-chips">
                {(result.detectedSkills || []).map((x) => (
                  <span key={x} className="lc-cva-chip">
                    {x}
                  </span>
                ))}
              </div>
            ) : (
              <p className="lc-cva-confidence">No dictionary keywords matched yet.</p>
            )}
          </div>

          {(result.strengths || []).length ? (
            <div className="lc-cva-section">
              <h4>Strengths</h4>
              <ul className="lc-cva-list">
                {(result.strengths || []).map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {(result.weakAreas || []).length ? (
            <div className="lc-cva-section">
              <h4>Weak areas</h4>
              <ul className="lc-cva-list">
                {(result.weakAreas || []).map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {(result.missingSections || []).length ? (
            <div className="lc-cva-section">
              <h4>Missing sections</h4>
              <div className="lc-cva-missing">{(result.missingSections || []).join(" · ")}</div>
            </div>
          ) : null}

          {(result.missingImportantKeywords || []).length ? (
            <div className="lc-cva-section">
              <h4>Keywords to consider for your field</h4>
              <div className="lc-cva-chips">
                {(result.missingImportantKeywords || []).slice(0, 12).map((x) => (
                  <span key={x} className="lc-cva-badge">
                    {x}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {(result.improvementSuggestions || []).length ? (
            <div className="lc-cva-section">
              <h4>Suggested improvements</h4>
              <div className="lc-cva-improve">
                {(result.improvementSuggestions || []).map((x) => (
                  <div key={x} className="lc-cva-improve-item">
                    {x}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {(result.recommendedKeywords || []).length ? (
            <div className="lc-cva-section">
              <h4>Recommended keywords</h4>
              <div className="lc-cva-chips">
                {(result.recommendedKeywords || []).map((x) => (
                  <span key={x} className="lc-cva-chip">
                    {x}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {result.extractedTextPreview ? (
            <div className="lc-cva-section">
              <h4>Text preview (trimmed)</h4>
              <p className="lc-cva-preview">{result.extractedTextPreview}</p>
            </div>
          ) : null}
        </>
      ) : null}

      <p className="lc-cva-note">
        Adding missing keywords and sections can improve your job match score.
      </p>
    </div>
  );
}
