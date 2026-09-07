import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { GameMasterLayer } from "./features/campaigns/gm/GameMasterLayer";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <GameMasterLayer />
  </StrictMode>,
);
