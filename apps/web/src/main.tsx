import { Component, StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import {
  installAssetReloadRecovery,
  markAssetLoadSucceeded,
} from "./assetReloadRecovery";
import "./styles.css";

installAssetReloadRecovery();

const root = document.getElementById("root");
if (!root) throw new Error("Root element #root not found");
const appRoot = root;

function renderShell(
  title: string,
  body: string,
  tone: "loading" | "error" = "loading",
) {
  const titleColor = tone === "error" ? "#f1a79a" : "#ede8dd";
  const bodyColor = tone === "error" ? "#f1a79a" : "#b4b4aa";
  appRoot.innerHTML = `
    <div style="padding: 38px 4%; font-family: system-ui, sans-serif; color: ${bodyColor}; background: radial-gradient(ellipse at 15% 0%, #363329 0, transparent 45%), #151719; min-height: 100vh;">
      <h1 style="margin: 0 0 8px; font: 400 32px Georgia, serif; color: ${titleColor};">${title}</h1>
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
            padding: "38px 4%",
            fontFamily: "system-ui, sans-serif",
            color: "#f1a79a",
            background:
              "radial-gradient(ellipse at 15% 0%, #363329 0, transparent 45%), #151719",
            minHeight: "100vh",
          }}
        >
          <h1
            style={{
              margin: "0 0 8px",
              font: "400 32px Georgia, serif",
              color: "#f1a79a",
            }}
          >
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
          <p style={{ marginTop: 12, color: "#b4b4aa" }}>
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
  const { initializeCloudPersistence } = await import("./lib/cloudPersistence");
  const { AppRouter } = await import("./app/AppRouter");
  markAssetLoadSucceeded();
  createRoot(appRoot).render(
    <StrictMode>
      <AppErrorBoundary>
        <AppRouter />
      </AppErrorBoundary>
    </StrictMode>,
  );
  void initializeCloudPersistence();
  if (import.meta.env.PROD && "serviceWorker" in navigator) {
    void navigator.serviceWorker.register("/sw.js").catch(console.warn);
  }
}

void bootstrap().catch((error) => {
  console.error("Mathfinder bootstrap failed", error);
  const message = error instanceof Error ? error.message : String(error);
  renderShell(
    "Mathfinder server error",
    `Unable to connect to the Mathfinder server. Your data cannot be loaded or saved right now.\n\n${message}\n\nConfirm Supabase is running, then refresh this page.`,
    "error",
  );
});
