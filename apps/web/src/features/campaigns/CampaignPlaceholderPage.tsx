import { HeaderProfile } from "../../components/ProfileMenu";
import { Link } from "react-router-dom";
import "../home/home.css";
import "../home/home-responsive.css";

interface CampaignPlaceholderPageProps {
  mode: "new" | "join";
}

export function CampaignPlaceholderPage({
  mode,
}: CampaignPlaceholderPageProps) {
  const creating = mode === "new";
  return (
    <div className="home-page">
      <header className="home-header">
        <Link className="home-brand" to="/">
          <span className="home-brand-mark">M</span>
          <span>Mathfinder</span>
        </Link>
        <HeaderProfile />
      </header>
      <main className="form-page">
        <section className="form-card">
          <span className="eyebrow">
            {creating ? "Start campaign" : "Join campaign"}
          </span>
          <h1>
            {creating
              ? "Gather the party—almost."
              : "Invitations need the shared backend."}
          </h1>
          <p>
            {creating
              ? "Local campaign creation arrives in the campaign phase. The homepage route is ready now, without pretending unfinished data is safely stored."
              : "Online invitations will use Supabase Auth and secure invite redemption. Until that exists, this screen refuses to lie about joining someone else’s campaign."}
          </p>
          <Link className="button-link" to="/">
            Return home
          </Link>
        </section>
      </main>
    </div>
  );
}
