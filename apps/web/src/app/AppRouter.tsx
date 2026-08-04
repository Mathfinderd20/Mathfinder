import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { HomePage } from "../features/home/HomePage";
import { CharacterWorkspace } from "../features/characters/CharacterWorkspace";
import { NewCharacterPage } from "../features/characters/NewCharacterPage";
import { ManageCharacterPage } from "../features/characters/ManageCharacterPage";
import { CampaignPlaceholderPage } from "../features/campaigns/CampaignPlaceholderPage";
import { CreateCampaignPage } from "../features/campaigns/CreateCampaignPage";
import { CampaignPage } from "../features/campaigns/CampaignPage";

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/characters/new" element={<NewCharacterPage />} />
        <Route
          path="/characters/:characterId/manage"
          element={<ManageCharacterPage />}
        />
        <Route
          path="/characters/:characterId"
          element={<CharacterWorkspace />}
        />
        <Route
          path="/characters/:characterId/:tab"
          element={<CharacterWorkspace />}
        />
        <Route path="/campaigns/new" element={<CreateCampaignPage />} />
        <Route path="/campaigns/:campaignId" element={<CampaignPage />} />
        <Route
          path="/campaigns/join"
          element={<CampaignPlaceholderPage mode="join" />}
        />
        <Route path="*" element={<Navigate replace to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
