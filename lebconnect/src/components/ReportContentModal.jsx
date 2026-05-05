import { useState } from "react";
import { Flag, Loader2 } from "lucide-react";
import Modal from "./Modal";
import api from "../api/axios";

/**
 * Submit content reports to POST /api/reports (authenticated).
 *
 * @param {{
 *   open: boolean;
 *   onClose: () => void;
 *   targetType: 'post' | 'user' | 'job' | 'company';
 *   targetId: number | string | null;
 *   title?: string;
 *   onSubmitted?: () => void;
 * }} props
 */
export default function ReportContentModal({
  open,
  onClose,
  targetType,
  targetId,
  title = "Report content",
  onSubmitted,
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setReason("");
    setError("");
    setBusy(false);
  };

  const handleClose = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const submit = async (e) => {
    e.preventDefault();
    const rid = Number(targetId);
    if (!Number.isFinite(rid)) {
      setError("Nothing to report for this item.");
      return;
    }
    const r = reason.trim();
    if (!r) {
      setError("Describe what concerns you.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.post("/api/reports", {
        targetType,
        targetId: rid,
        reason: r,
      });
      onSubmitted?.();
      reset();
      onClose();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Could not submit report."
      );
    } finally {
      setBusy(false);
    }
  };

  const idOk = Number.isFinite(Number(targetId));

  return (
    <Modal open={open} title={title} onClose={handleClose}>
      <form className="lc-report-modal-form" onSubmit={submit}>
        <p className="lc-report-modal-hint">
          Reports are reviewed by moderators. Abusive reports may affect your
          account.
        </p>
        {!idOk ? (
          <p className="lc-report-modal-err" role="alert">
            This item cannot be reported (missing id).
          </p>
        ) : null}
        <label className="lc-report-modal-label">
          Reason
          <textarea
            className="lc-report-modal-textarea"
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="What is wrong with this content?"
            disabled={busy || !idOk}
            maxLength={4000}
          />
        </label>
        {error ? (
          <p className="lc-report-modal-err" role="alert">
            {error}
          </p>
        ) : null}
        <div className="lc-report-modal-actions">
          <button
            type="button"
            className="link-like"
            onClick={handleClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="primary-btn lc-co-icon-btn"
            disabled={busy || !idOk}
          >
            {busy ? (
              <Loader2 className="lc-report-spin" size={18} strokeWidth={2.5} />
            ) : (
              <Flag size={17} strokeWidth={2} aria-hidden />
            )}
            Submit report
          </button>
        </div>
      </form>
    </Modal>
  );
}
