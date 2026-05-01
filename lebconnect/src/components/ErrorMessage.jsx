export default function ErrorMessage({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div className="lc-error-msg" role="alert">
      <span>{message}</span>
      {onDismiss ? (
        <button type="button" className="lc-error-dismiss" onClick={onDismiss}>
          ×
        </button>
      ) : null}
    </div>
  );
}
