import { Component } from "react";

/**
 * Catches render errors so a route never ends up as a silent blank screen.
 */
export default class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[RouteErrorBoundary]", error, info);
  }

  render() {
    if (this.state.error) {
      const devDetail = import.meta.env.DEV
        ? String(
            this.state.error?.message ||
              this.state.error ||
              "Unknown error"
          )
        : "";
      return (
        <div
          className="lc-route-error-boundary"
          style={{
            minHeight: "60vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
            boxSizing: "border-box",
          }}
        >
          <div
            className="lc-glass-card"
            style={{
              maxWidth: 420,
              width: "100%",
              padding: "1.5rem",
              color: "#0b1324",
            }}
          >
            <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.15rem" }}>
              {this.props.title || "Feed could not load"}
            </h2>
            <p style={{ margin: "0 0 1rem", opacity: 0.85 }}>
              Something went wrong while rendering this page. Try reloading, or sign
              in again if the problem continues.
            </p>
            {devDetail ? (
              <pre
                style={{
                  margin: "0 0 1rem",
                  padding: "0.75rem",
                  background: "rgba(0,0,0,0.06)",
                  borderRadius: 8,
                  fontSize: 12,
                  overflow: "auto",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {devDetail}
              </pre>
            ) : null}
            <button
              type="button"
              className="lc-btn lc-btn--primary lc-btn-hit"
              onClick={() => window.location.reload()}
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
