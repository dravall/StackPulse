"use client";

import { useCallback, useEffect, useState } from "react";
import AuthScreen from "./components/AuthScreen";
import Dashboard from "./components/Dashboard";

const STORAGE_KEY = "stackpulse.session";

type Session = { token: string; username: string };

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        setSession(JSON.parse(raw));
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
    setReady(true);
  }, []);

  const onAuthed = useCallback((token: string, username: string) => {
    const next = { token, username };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSession(next);
  }, []);

  const onSignOut = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    setSession(null);
  }, []);

  if (!ready) return null;

  return session ? (
    <Dashboard token={session.token} username={session.username} onSignOut={onSignOut} />
  ) : (
    <AuthScreen onAuthed={onAuthed} />
  );
}
