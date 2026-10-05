"use client";

import { useState } from "react";
import { ApiError, signin, signup } from "../../lib/api";

export default function AuthScreen({
  onAuthed,
}: {
  onAuthed: (token: string, username: string) => void;
}) {
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isSignup = tab === "signup";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!username.trim() || !password) {
      setError("Username and password are both required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (isSignup) {
        await signup(username.trim(), password);
      }
      const { jwt } = await signin(username.trim(), password);
      onAuthed(jwt, username.trim());
    } catch (e) {
      setError(e instanceof ApiError ? `${e.title} — ${e.msg}` : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 24px" }}>
      <div style={{ width: "100%", maxWidth: 380, display: "flex", flexDirection: "column", gap: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 8, height: 8, background: "var(--accent)" }} />
          <span style={{ fontFamily: "var(--font-plex-mono)", fontWeight: 600, fontSize: 15, letterSpacing: "0.02em" }}>
            stackpulse
          </span>
        </div>

        <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 2, padding: "24px 28px 28px", display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", gap: 20, borderBottom: "1px solid var(--line)", margin: "-4px 0 0" }}>
            <button
              type="button"
              onClick={() => { setTab("signin"); setError(null); }}
              style={tabStyle(!isSignup)}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => { setTab("signup"); setError(null); }}
              style={tabStyle(isSignup)}
            >
              Sign up
            </button>
          </div>

          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={labelStyle}>Username</span>
              <input
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError(null); }}
                autoComplete="username"
                placeholder="dana.k"
                style={inputStyle}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={labelStyle}>Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(null); }}
                autoComplete={isSignup ? "new-password" : "current-password"}
                style={inputStyle}
              />
            </label>
            {error && (
              <div role="alert" style={{ padding: "9px 12px", border: "1px solid var(--down)", background: "var(--down-soft)", color: "var(--down)", borderRadius: 2, fontSize: 13 }}>
                {error}
              </div>
            )}
            <button type="submit" disabled={busy} style={submitStyle}>
              {busy ? (isSignup ? "Creating account…" : "Signing in…") : isSignup ? "Create account" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--font-plex-mono)",
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--text3)",
};

const inputStyle: React.CSSProperties = {
  height: 40,
  padding: "0 12px",
  font: "400 14px var(--font-plex-mono)",
  color: "var(--text)",
  background: "var(--field)",
  border: "1px solid var(--line2)",
  borderRadius: 2,
  outline: "none",
};

const submitStyle: React.CSSProperties = {
  height: 40,
  marginTop: 4,
  border: 0,
  borderRadius: 2,
  background: "var(--accent)",
  color: "var(--accent-ink)",
  font: "600 14px var(--font-plex-sans)",
  cursor: "pointer",
};

function tabStyle(active: boolean): React.CSSProperties {
  return {
    height: 36,
    padding: 0,
    marginBottom: -1,
    border: 0,
    borderBottom: `2px solid ${active ? "var(--accent)" : "transparent"}`,
    cursor: "pointer",
    font: "500 14px var(--font-plex-sans)",
    background: "transparent",
    color: active ? "var(--text)" : "var(--text3)",
  };
}
