"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiError,
  createWebsite,
  deleteWebsite,
  listWebsites,
  updateWebsite,
  type Website,
} from "../../lib/api";

type FieldError = { code: string; label: string; kind: string; title: string; msg: string };

function localError(msg: string): FieldError {
  return { code: "400", label: "Bad Request", kind: "invalid", title: "Invalid input", msg };
}

function asFieldError(e: unknown): FieldError {
  if (e instanceof ApiError) return { code: e.code, label: e.label, kind: e.kind, title: e.title, msg: e.msg };
  return localError("Something went wrong. Try again.");
}

function basicValidate(raw: string): string | null {
  const v = raw.trim();
  if (!v) return "Enter a URL.";
  let u: URL;
  try {
    u = new URL(v);
  } catch {
    return "Include the scheme and host, e.g. https://example.com/health.";
  }
  if (!/^https?:$/.test(u.protocol)) return "Only http:// and https:// URLs can be monitored.";
  return null;
}

function normalize(raw: string): string {
  try {
    const u = new URL(raw.trim());
    return u.protocol + "//" + u.host.toLowerCase() + u.pathname.replace(/\/+$/, "") + u.search;
  } catch {
    return raw.trim();
  }
}

function relativeTime(iso: string, now: number): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

const statusVar: Record<string, string> = { Up: "up", Down: "down", Unknown: "unk" };

export default function Dashboard({
  token,
  username,
  onSignOut,
}: {
  token: string;
  username: string;
  onSignOut: () => void;
}) {
  const [sites, setSites] = useState<Website[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [now, setNow] = useState(Date.now());

  const [adding, setAdding] = useState(false);
  const [addUrl, setAddUrl] = useState("");
  const [addError, setAddError] = useState<FieldError | null>(null);
  const [addBusy, setAddBusy] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editUrl, setEditUrl] = useState("");
  const [editError, setEditError] = useState<FieldError | null>(null);
  const [editBusy, setEditBusy] = useState(false);

  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const sitesRef = useRef(sites);
  sitesRef.current = sites;

  const loadSites = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    listWebsites(token)
      .then(({ websites, nextCursor }) => {
        setSites(websites);
        setCursor(nextCursor);
        setLoading(false);
      })
      .catch((e) => {
        if (e instanceof ApiError && e.kind === "auth") return onSignOut();
        setLoadError(e instanceof ApiError ? e.msg : "Couldn't reach the server.");
        setLoading(false);
      });
  }, [token, onSignOut]);

  useEffect(() => {
    loadSites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    const poll = setInterval(() => {
      const count = sitesRef.current.length;
      if (count === 0) return;
      listWebsites(token, null, count)
        .then(({ websites }) => setSites(websites))
        .catch((e) => {
          if (e instanceof ApiError && e.kind === "auth") onSignOut();
          // any other polling error is transient — leave the current rows as-is
        });
    }, 10000);
    return () => clearInterval(poll);
  }, [token, onSignOut]);

  const openAdd = useCallback(() => {
    setAdding(true);
    setAddError(null);
    setEditingId(null);
    setConfirmId(null);
  }, []);
  const closeAdd = useCallback(() => {
    setAdding(false);
    setAddError(null);
    setAddUrl("");
  }, []);

  async function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    if (addBusy) return;
    const localMsg = basicValidate(addUrl);
    if (localMsg) return setAddError(localError(localMsg));
    setAddBusy(true);
    try {
      const { id } = await createWebsite(token, addUrl.trim());
      setSites((s) => [{ id, url: addUrl.trim(), latestTick: null }, ...s]);
      setAdding(false);
      setAddUrl("");
      setAddError(null);
    } catch (e) {
      setAddError(asFieldError(e));
    } finally {
      setAddBusy(false);
    }
  }

  function startEdit(site: Website) {
    setEditingId(site.id);
    setEditUrl(site.url);
    setEditError(null);
    setConfirmId(null);
    setAdding(false);
  }

  async function saveEdit(e: React.FormEvent, id: string) {
    e.preventDefault();
    if (editBusy) return;
    const localMsg = basicValidate(editUrl);
    if (localMsg) return setEditError(localError(localMsg));
    setEditBusy(true);
    try {
      const url = editUrl.trim();
      await updateWebsite(token, id, url);
      setSites((s) => s.map((x) => (x.id === id ? { ...x, url } : x)));
      setEditingId(null);
      setEditError(null);
    } catch (e) {
      setEditError(asFieldError(e));
    } finally {
      setEditBusy(false);
    }
  }

  async function confirmDelete(id: string) {
    if (deleteBusy) return;
    setDeleteBusy(true);
    try {
      await deleteWebsite(token, id);
      setSites((s) => s.filter((x) => x.id !== id));
      setConfirmId(null);
    } finally {
      setDeleteBusy(false);
    }
  }

  async function loadMore() {
    if (loadingMore || !cursor) return;
    setLoadingMore(true);
    const { websites, nextCursor } = await listWebsites(token, cursor);
    setSites((s) => [...s, ...websites]);
    setCursor(nextCursor);
    setLoadingMore(false);
  }

  const dupId =
    addError?.kind === "dup" ? sites.find((s) => normalize(s.url) === normalize(addUrl))?.id ?? null : null;

  const count = (status: string) =>
    sites.filter((s) => (s.latestTick ? s.latestTick.status : "Unknown") === status).length;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, height: 56, padding: "0 32px", background: "var(--surface)", borderBottom: "1px solid var(--line)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 8, height: 8, background: "var(--accent)" }} />
          <span style={{ fontFamily: "var(--font-plex-mono)", fontWeight: 600, fontSize: 14, letterSpacing: "0.02em" }}>stackpulse</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontFamily: "var(--font-plex-mono)", fontSize: 13 }}>{username}</span>
          <button type="button" onClick={onSignOut} style={outlineBtnStyle}>Sign out</button>
        </div>
      </header>

      <main style={{ width: "100%", maxWidth: 1120, margin: "0 auto", padding: "36px 32px 48px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>Sites</h1>
            {sites.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 14, fontFamily: "var(--font-plex-mono)", fontSize: 12, color: "var(--text2)" }}>
                <span><span style={{ color: "var(--up)", fontWeight: 600 }}>{count("Up")}</span> up</span>
                <span><span style={{ color: "var(--down)", fontWeight: 600 }}>{count("Down")}</span> down</span>
                <span><span style={{ color: "var(--unk)", fontWeight: 600 }}>{count("Unknown")}</span> unknown</span>
                <span style={{ color: "var(--text3)" }}>({sites.length} loaded)</span>
              </div>
            )}
          </div>
          {!adding && (
            <button type="button" onClick={openAdd} style={primaryBtnStyle}>Add site</button>
          )}
        </div>

        {adding && (
          <form onSubmit={submitAdd} style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 2, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
            <label htmlFor="sp-add-url" style={labelStyle}>URL to monitor</label>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input
                id="sp-add-url"
                autoFocus
                value={addUrl}
                onChange={(e) => { setAddUrl(e.target.value); setAddError(null); }}
                placeholder="https://example.com/health"
                spellCheck={false}
                style={{ ...fieldInputStyle, flex: "1 1 320px", minWidth: 0, borderColor: addError ? "var(--down)" : "var(--line2)" }}
              />
              <button type="submit" disabled={addBusy} style={{ ...primaryBtnStyle, height: 40, minWidth: 92 }}>
                {addBusy ? "Adding…" : "Add site"}
              </button>
              <button type="button" onClick={closeAdd} style={{ ...outlineBtnStyle, height: 40 }}>Cancel</button>
            </div>
            {addError ? (
              <div role="alert" style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "12px 14px", border: "1px solid var(--down)", background: "var(--down-soft)", borderRadius: 2 }}>
                <span style={errCodeStyle}>{addError.code} {addError.label}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{addError.title}</div>
                  <div style={{ marginTop: 2, fontSize: 13, color: "var(--text2)" }}>{addError.msg}</div>
                </div>
                {dupId && (
                  <button
                    type="button"
                    onClick={() => { const s = sites.find((x) => x.id === dupId); if (s) startEdit(s); }}
                    style={{ ...outlineBtnStyle, height: 28, flex: "none" }}
                  >
                    Edit existing
                  </button>
                )}
              </div>
            ) : (
              <div style={{ fontFamily: "var(--font-plex-mono)", fontSize: 12, color: "var(--text3)" }}>
                Public http(s) URLs only. Private and internal hosts are rejected.
              </div>
            )}
          </form>
        )}

        {loading ? null : loadError ? (
          <div style={{ background: "var(--surface)", border: "1px solid var(--down)", borderRadius: 2, padding: "24px 28px", display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <div style={{ fontWeight: 600, color: "var(--down)" }}>Couldn&apos;t load your sites</div>
              <div style={{ marginTop: 4, fontSize: 13, color: "var(--text2)" }}>{loadError}</div>
            </div>
            <button type="button" onClick={loadSites} style={{ ...outlineBtnStyle, height: 34, alignSelf: "flex-start" }}>Retry</button>
          </div>
        ) : sites.length === 0 ? (
          <div style={{ background: "var(--surface)", border: "1px dashed var(--line2)", borderRadius: 2, padding: "56px 32px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 10 }}>
            <div style={{ fontSize: 17, fontWeight: 600 }}>No sites yet</div>
            <div style={{ maxWidth: 420, color: "var(--text2)" }}>Add a URL to start checking it. Status appears after the first check.</div>
            {!adding && (
              <button type="button" onClick={openAdd} style={{ ...primaryBtnStyle, marginTop: 8, height: 38 }}>Add site</button>
            )}
          </div>
        ) : (
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 2, overflow: "hidden" }}>
            <div style={gridRowStyle("var(--surface2)")}>
              <span style={headCellStyle}>Status</span>
              <span style={headCellStyle}>URL</span>
              <span style={{ ...headCellStyle, textAlign: "right" }}>Response</span>
              <span style={{ ...headCellStyle, textAlign: "right" }}>Last check</span>
              <span />
            </div>

            {sites.map((s) => {
              const t = s.latestTick;
              const status = t ? t.status : "Unknown";
              const c = statusVar[status];
              const match = s.url.match(/^(https?:\/\/)(.*)$/i);
              const scheme = match ? match[1] : "";
              const rest = match ? match[2] : s.url;
              const isEditing = editingId === s.id;
              const isConfirm = confirmId === s.id;
              const highlighted = s.id === dupId;

              return (
                <div key={s.id} style={{ borderTop: "1px solid var(--line)", background: highlighted ? "var(--accent-soft)" : "transparent" }}>
                  {isEditing ? (
                    <form onSubmit={(e) => saveEdit(e, s.id)} style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 10, background: "var(--surface2)" }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ ...labelStyle, width: 94 }}>Edit URL</span>
                        <input
                          autoFocus
                          value={editUrl}
                          onChange={(e) => { setEditUrl(e.target.value); setEditError(null); }}
                          spellCheck={false}
                          style={{ ...fieldInputStyle, flex: "1 1 300px", minWidth: 0, height: 36, borderColor: editError ? "var(--down)" : "var(--line2)" }}
                        />
                        <button type="submit" disabled={editBusy} style={{ ...primaryBtnStyle, height: 36 }}>{editBusy ? "Saving…" : "Save"}</button>
                        <button type="button" onClick={() => { setEditingId(null); setEditError(null); }} style={{ ...outlineBtnStyle, height: 36 }}>Cancel</button>
                      </div>
                      {editError && (
                        <div role="alert" style={{ marginLeft: 104, display: "flex", gap: 12, alignItems: "baseline", fontSize: 13 }}>
                          <span style={{ font: "600 11px var(--font-plex-mono)", color: "var(--down)" }}>{editError.code} {editError.label}</span>
                          <span style={{ color: "var(--text2)" }}>
                            <span style={{ color: "var(--text)", fontWeight: 600 }}>{editError.title}.</span> {editError.msg}
                          </span>
                        </div>
                      )}
                    </form>
                  ) : isConfirm ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", padding: "14px 20px", background: "var(--down-soft)" }}>
                      <div>Stop monitoring <span style={{ fontFamily: "var(--font-plex-mono)", fontWeight: 500 }}>{rest}</span>?</div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button type="button" onClick={() => setConfirmId(null)} style={{ ...outlineBtnStyle, height: 32, background: "var(--surface)" }}>Cancel</button>
                        <button type="button" disabled={deleteBusy} onClick={() => confirmDelete(s.id)} style={{ height: 32, padding: "0 12px", border: 0, borderRadius: 2, background: "var(--down)", color: "#fff", font: "600 13px var(--font-plex-sans)", cursor: "pointer" }}>
                          {deleteBusy ? "Deleting…" : "Delete site"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={gridRowStyle(undefined, "14px 20px")}>
                      <span style={{ display: "inline-flex", alignItems: "center", width: "fit-content", height: 22, padding: "0 7px", border: `1px solid var(--${c})`, background: `var(--${c}-soft)`, color: `var(--${c})`, borderRadius: 2, font: "600 11px var(--font-plex-mono)", letterSpacing: "0.06em" }}>
                        {status.toUpperCase()}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontFamily: "var(--font-plex-mono)", fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={s.url}>
                          <span style={{ color: "var(--text3)" }}>{scheme}</span>
                          <span style={{ fontWeight: 500 }}>{rest}</span>
                        </div>
                        {t?.error_message ? (
                          <div style={{ marginTop: 4, fontFamily: "var(--font-plex-mono)", fontSize: 12, color: `var(--${c})`, overflowWrap: "anywhere" }}>{t.error_message}</div>
                        ) : !t ? (
                          <div style={{ marginTop: 4, fontFamily: "var(--font-plex-mono)", fontSize: 12, color: "var(--text3)" }}>Awaiting first check…</div>
                        ) : null}
                      </div>
                      <div style={{ textAlign: "right", fontFamily: "var(--font-plex-mono)", fontSize: 13, fontVariantNumeric: "tabular-nums", color: t?.response_time_ms && t.response_time_ms > 1000 ? "var(--unk)" : t?.response_time_ms != null ? "var(--text)" : "var(--text3)" }}>
                        {t?.response_time_ms != null ? `${t.response_time_ms.toLocaleString("en-US")} ms` : "—"}
                      </div>
                      <div title={t?.createdAt ?? "No check yet"} style={{ textAlign: "right", fontFamily: "var(--font-plex-mono)", fontSize: 13, color: "var(--text2)", fontVariantNumeric: "tabular-nums" }}>
                        {t ? relativeTime(t.createdAt, now) : "—"}
                      </div>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 4 }}>
                        <button type="button" onClick={() => startEdit(s)} style={ghostBtnStyle}>Edit</button>
                        <button type="button" onClick={() => { setConfirmId(s.id); setEditingId(null); }} style={ghostBtnStyle}>Delete</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "12px 20px", borderTop: "1px solid var(--line)", background: "var(--surface2)" }}>
              <span style={{ fontFamily: "var(--font-plex-mono)", fontSize: 12, color: "var(--text3)" }}>Showing {sites.length} sites</span>
              {cursor ? (
                <button type="button" onClick={loadMore} style={outlineBtnStyle}>{loadingMore ? "Loading…" : "Load more"}</button>
              ) : (
                <span style={{ fontFamily: "var(--font-plex-mono)", fontSize: 12, color: "var(--text3)" }}>End of list</span>
              )}
            </div>
          </div>
        )}
      </main>
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

const fieldInputStyle: React.CSSProperties = {
  height: 40,
  padding: "0 12px",
  font: "400 14px var(--font-plex-mono)",
  color: "var(--text)",
  background: "var(--field)",
  border: "1px solid var(--line2)",
  borderRadius: 2,
  outline: "none",
};

const primaryBtnStyle: React.CSSProperties = {
  height: 36,
  padding: "0 14px",
  border: 0,
  borderRadius: 2,
  background: "var(--accent)",
  color: "var(--accent-ink)",
  font: "600 13px var(--font-plex-sans)",
  cursor: "pointer",
};

const outlineBtnStyle: React.CSSProperties = {
  height: 30,
  padding: "0 12px",
  border: "1px solid var(--line2)",
  borderRadius: 2,
  background: "transparent",
  color: "var(--text2)",
  font: "500 13px var(--font-plex-sans)",
  cursor: "pointer",
};

const ghostBtnStyle: React.CSSProperties = {
  height: 28,
  padding: "0 10px",
  border: "1px solid transparent",
  borderRadius: 2,
  background: "transparent",
  color: "var(--text2)",
  font: "500 12px var(--font-plex-sans)",
  cursor: "pointer",
};

const errCodeStyle: React.CSSProperties = {
  flex: "none",
  font: "600 11px var(--font-plex-mono)",
  letterSpacing: "0.04em",
  color: "var(--down)",
  border: "1px solid var(--down)",
  borderRadius: 2,
  padding: "0 6px",
  lineHeight: "20px",
};

const headCellStyle: React.CSSProperties = {
  fontFamily: "var(--font-plex-mono)",
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--text3)",
};

function gridRowStyle(background?: string, padding = "10px 20px"): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "104px minmax(0,1fr) 100px 110px 128px",
    gap: 16,
    alignItems: "center",
    padding,
    background,
  };
}
