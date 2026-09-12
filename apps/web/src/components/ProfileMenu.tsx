import { useEffect, useId, useRef, useState } from "react";
import {
  type CloudConnectionState,
  exportUnsyncedCopy,
  reloadServerCopy,
  signOut,
} from "../lib/cloudPersistence";
import "./profile-menu.css";
import { useCloudConnection } from "../lib/useCloudConnection";

export function HeaderProfile() {
  const cloud = useCloudConnection();
  if (cloud.status !== "connected" && cloud.status !== "offline") return null;
  return <ProfileMenu cloud={cloud} />;
}

export function ProfileMenu({
  cloud,
}: {
  cloud: Extract<CloudConnectionState, { userId: string }>;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div
      className="profile-menu"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node))
          setOpen(false);
      }}
    >
      <button
        className="profile-trigger"
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          aria-hidden="true"
        >
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
        </svg>
        Profile <span aria-hidden="true">{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <section
          id={panelId}
          className="profile-panel"
          aria-label="Your profile"
        >
          <strong>Your account</strong>
          {import.meta.env.VITE_APP_ENV === "staging" && (
            <a href="/admin/ingestion">Catalogue imports</a>
          )}
          <div className="profile-email">
            {cloud.name} <span aria-hidden="true">|</span>{" "}
            <span className="profile-sync" role="status">
              {cloud.status === "offline"
                ? "Offline"
                : cloud.pending
                  ? "Saving changes…"
                  : "Synced"}
            </span>
          </div>
          {cloud.message && <p className="profile-message">{cloud.message}</p>}
          {cloud.pending && (
            <>
              <button type="button" onClick={exportUnsyncedCopy}>
                Export unsynced copy
              </button>
              <button
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      "Discard unsynced changes and load the server copy? Export them first if you want to keep them.",
                    )
                  )
                    void reloadServerCopy();
                }}
              >
                Load server copy
              </button>
            </>
          )}
          <button
            className="profile-signout"
            type="button"
            onClick={() => {
              if (
                !cloud.pending ||
                window.confirm(
                  "Signing out removes unsynced changes from this device. Export them first. Continue?",
                )
              )
                void signOut();
            }}
          >
            Sign out
          </button>
        </section>
      )}
    </div>
  );
}
