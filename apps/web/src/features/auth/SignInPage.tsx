import { useState, type FormEvent } from "react";
import { supabase } from "../../lib/supabaseClient";
import { rememberAuthReturnPath, safeReturnPath } from "./authNavigation";
import "./auth.css";

export function SignInPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const params = new URLSearchParams(window.location.search);
  const [message, setMessage] = useState(
    params.get("error_description")
      ? "That sign-in link could not be completed. Request a new link."
      : "",
  );
  const next = safeReturnPath(params.get("next"));
  const callback = new URL("/auth/callback", window.location.origin);
  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMessage("");
    try {
      rememberAuthReturnPath(next);
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: callback.href },
      });
      if (error) throw error;
      setMessage(
        "Check your email for a sign-in link. Open it in this browser to continue.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Sign-in is unavailable. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function google() {
    if (!supabase) return;
    setBusy(true);
    setMessage("");
    try {
      rememberAuthReturnPath(next);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callback.href,
          queryParams: { prompt: "select_account" },
        },
      });
      if (error) throw error;
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Google sign-in is unavailable.",
      );
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <section className="auth-card">
        <p>Mathfinder · Pathfinder First Edition</p>
        <h1>Welcome to your adventure.</h1>
        <p>Sign in to access your characters and campaigns on any device.</p>
        <button type="button" disabled={busy} onClick={() => void google()}>
          Continue with Google
        </button>
        <form onSubmit={submit}>
          <label htmlFor="auth-email">Email address</label>
          <input
            id="auth-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
          />
          <button disabled={busy} type="submit">
            {busy ? "Please wait…" : "Email me a sign-in link"}
          </button>
        </form>
        <p role="status">{message}</p>
        <small>
          After signing in, this browser saves a copy for viewing during
          outages. Signing out removes that copy.
        </small>
      </section>
    </main>
  );
}
