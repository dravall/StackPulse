const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export type TickStatus = "Up" | "Down" | "Unknown";

export type Tick = {
    response_time_ms: number | null;
    status: TickStatus;
    error_message: string | null;
    createdAt: string;
};

export type Website = {
    id: string;
    url: string;
    latestTick: Tick | null;
};

export type ApiErrorKind = "ssrf" | "dup" | "invalid" | "auth" | "rate_limit" | "other";

export class ApiError extends Error {
    code: string;
    label: string;
    kind: ApiErrorKind;
    title: string;
    msg: string;

    constructor(status: number, message: string) {
        super(message);
        this.code = String(status);
        this.label = labelFor(status);
        this.kind = classify(status, message);
        this.title = titleFor(this.kind);
        this.msg = message;
    }
}

function labelFor(status: number): string {
    switch (status) {
        case 400: return "Bad Request";
        case 401: return "Unauthorized";
        case 404: return "Not Found";
        case 409: return "Conflict";
        case 429: return "Too Many Requests";
        default: return "Error";
    }
}

function classify(status: number, message: string): ApiErrorKind {
    const m = message.toLowerCase();
    if (status === 409 && m.includes("already monitoring")) return "dup";
    if (status === 400 && m.includes("private or internal")) return "ssrf";
    if (status === 400) return "invalid";
    if (status === 401) return "auth";
    if (status === 429) return "rate_limit";
    return "other";
}

function titleFor(kind: ApiErrorKind): string {
    switch (kind) {
        case "dup": return "Already monitoring this URL";
        case "ssrf": return "Private or internal address";
        case "invalid": return "Invalid input";
        case "auth": return "Authentication failed";
        case "rate_limit": return "Too many attempts";
        default: return "Something went wrong";
    }
}

async function apiFetch<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(options.headers as Record<string, string> | undefined),
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${API_URL}${path}`, { ...options, headers });

    if (!res.ok) {
        let message = res.statusText || "Request failed";
        try {
            const body = await res.json();
            if (body && typeof body.error === "string") message = body.error;
        } catch {
            // non-JSON error body (e.g. the rate limiter's plain-text 429) — keep statusText
        }
        throw new ApiError(res.status, message);
    }

    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
}

export function signup(username: string, password: string): Promise<{ id: string }> {
    return apiFetch("/user/signup", {
        method: "POST",
        body: JSON.stringify({ username, password }),
    });
}

export function signin(username: string, password: string): Promise<{ jwt: string }> {
    return apiFetch("/user/signin", {
        method: "POST",
        body: JSON.stringify({ username, password }),
    });
}

export function listWebsites(
    token: string,
    cursor?: string | null,
    limit = 20
): Promise<{ websites: Website[]; nextCursor: string | null }> {
    const qs = cursor
        ? `?limit=${limit}&cursor=${encodeURIComponent(cursor)}`
        : `?limit=${limit}`;
    return apiFetch(`/websites${qs}`, {}, token);
}

export function createWebsite(token: string, url: string): Promise<{ id: string }> {
    return apiFetch("/website", { method: "POST", body: JSON.stringify({ url }) }, token);
}

export function updateWebsite(token: string, id: string, url: string): Promise<{ id: string; url: string }> {
    return apiFetch(`/website/${id}`, { method: "PATCH", body: JSON.stringify({ url }) }, token);
}

export function deleteWebsite(token: string, id: string): Promise<void> {
    return apiFetch(`/website/${id}`, { method: "DELETE" }, token);
}
