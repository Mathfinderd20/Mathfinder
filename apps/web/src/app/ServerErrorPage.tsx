interface ServerErrorPageProps {
  message: string;
}

export function ServerErrorPage({ message }: ServerErrorPageProps) {
  return (
    <main
      role="alert"
      style={{
        alignItems: "center",
        background: "#111827",
        color: "#fecaca",
        display: "flex",
        justifyContent: "center",
        minHeight: "100vh",
        padding: 24,
      }}
    >
      <section style={{ maxWidth: 640 }}>
        <span style={{ color: "#f87171", fontWeight: 700 }}>SERVER ERROR</span>
        <h1 style={{ color: "#fca5a5", fontSize: 32, marginBottom: 12 }}>
          Mathfinder cannot reach Supabase.
        </h1>
        <p style={{ color: "#e5e7eb", lineHeight: 1.6 }}>
          Your data cannot be loaded or saved right now. Mathfinder has stopped
          to prevent you from accidentally working with stale local data.
        </p>
        <pre
          style={{
            background: "#1f2937",
            border: "1px solid #7f1d1d",
            borderRadius: 8,
            color: "#fecaca",
            overflowWrap: "anywhere",
            padding: 16,
            whiteSpace: "pre-wrap",
          }}
        >
          {message}
        </pre>
        <button onClick={() => window.location.reload()} type="button">
          Retry connection
        </button>
      </section>
    </main>
  );
}
