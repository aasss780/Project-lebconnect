export default function Modal({
  open,
  title,
  children,
  onClose,
  /** Wider panels for structured forms */
  wide = false,
}) {
  if (!open) return null;
  return (
    <div
      className="lc-modal-overlay"
      role="presentation"
      onClick={onClose}
    >
      <div
        className={`lc-modal-panel${wide ? " lc-modal-panel--wide" : ""}`}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="lc-modal-head">
          <h3>{title}</h3>
          <button type="button" className="lc-modal-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="lc-modal-body">{children}</div>
      </div>
    </div>
  );
}
