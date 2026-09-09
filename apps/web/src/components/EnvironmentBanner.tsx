import { appEnvironment } from "../lib/appEnvironment";
import "./environment-banner.css";

export function EnvironmentBanner() {
  if (appEnvironment !== "staging") return null;
  return (
    <aside className="environment-banner" aria-label="Staging environment">
      <strong>Staging</strong>
      <span>Disposable test data</span>
    </aside>
  );
}
