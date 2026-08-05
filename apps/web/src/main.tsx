import { Component, StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Root element #root not found");
const appRoot = root;

function renderShell(
  title: string,
  body: string,
  tone: "loading" | "error" = "loading",
) {
  const titleColor = tone === "error" ? "#fca5a5" : "#e5e7eb";
  const bodyColor = tone === "error" ? "#fecaca" : "#cbd5e1";
  appRoot.innerHTML = `
    <div style="padding: 16px; font-family: system-ui, sans-serif; color: ${bodyColor}; background: #111827; min-height: 100vh;">
      <h1 style="margin: 0 0 8px; font-size: 20px; color: ${titleColor};">${title}</h1>
      <pre style="white-space: pre-wrap; word-break: break-word; margin: 0; color: ${bodyColor}; font-family: inherit;">${body}</pre>
    </div>
  `;
}

renderShell("Mathfinder", "Opening your adventure hub…");

class AppErrorBoundary extends Component<
  { children: ReactNode },
  { error: string | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: unknown) {
    const message =
      error instanceof Error
        ? `${error.name}: ${error.message}\n\n${error.stack ?? ""}`
        : String(error);
    return { error: message };
  }

  componentDidCatch(error: unknown) {
    console.error("Mathfinder render failed", error);
  }

  override render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: 16,
            fontFamily: "system-ui, sans-serif",
            color: "#fecaca",
            background: "#111827",
            minHeight: "100vh",
          }}
        >
          <h1 style={{ margin: "0 0 8px", fontSize: 20, color: "#fca5a5" }}>
            Mathfinder render failed
          </h1>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              margin: 0,
              color: "#fecaca",
              fontFamily: "inherit",
            }}
          >
            {this.state.error}
          </pre>
          <p style={{ marginTop: 12, color: "#cbd5e1" }}>
            Open DevTools console for the full stack trace.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

window.addEventListener("error", (event) => {
  console.error("Mathfinder window error", event.error ?? event.message);
  renderShell(
    "Mathfinder crashed",
    String(event.error?.stack ?? event.error?.message ?? event.message),
    "error",
  );
});
window.addEventListener("unhandledrejection", (event) => {
  console.error("Mathfinder unhandled rejection", event.reason);
  const reason =
    event.reason instanceof Error
      ? `${event.reason.name}: ${event.reason.message}\n\n${event.reason.stack ?? ""}`
      : String(event.reason);
  renderShell("Mathfinder unhandled rejection", reason, "error");
});

async function bootstrap() {
  const { AppRouter } = await import("./app/AppRouter");
  createRoot(appRoot).render(
    <StrictMode>
      <AppErrorBoundary>
        <AppRouter />
      </AppErrorBoundary>
    </StrictMode>,
  );
}

void bootstrap().catch((error) => {
  console.error("Mathfinder bootstrap failed", error);
  const message =
    error instanceof Error
      ? `${error.name}: ${error.message}\n\n${error.stack ?? ""}`
      : String(error);
  renderShell("Mathfinder failed to start", message, "error");
});
