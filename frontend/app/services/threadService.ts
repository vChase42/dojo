// app/services/threadService.ts

export interface ThreadStats {
  groupIri: string;
  rootNoteIri: string;
  title: string;
  creatorIri: string;

  replyCount: number;
  lastActivityAt: string;

  isLocked: boolean;
  isPinned: boolean;
  isDeleted: boolean;

  createdAt: string;
}

/**
 * What your /api/thread/:id returns (Mongo Note objects).
 * Keep it flexible because AP JSON-LD shapes vary.
 */
export interface NoteObject {
  id: string;
  type: "Note" | string;
  content?: string;

  attributedTo?: any;
  published?: string;

  inReplyTo?: any;
  context?: any;
  to?: any;
  cc?: any;

  _local?: {
    threadRoot?: string;
    depth?: number;
    [key: string]: any;
  };

  [key: string]: any;
}

export interface ThreadResponse {
  threadStats: ThreadStats;
  notes: NoteObject[];
}

const API_BASE = "/api";

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "API request failed");
  }

  return res.json();
}

/**
 * Normalize JSON-LD values into an IRI string where possible.
 */
export function iriFromValue(value: any): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return iriFromValue(value[0]);
  if (typeof value === "object" && typeof value.id === "string") return value.id;
  return null;
}

/**
 * Optional: fetch a remote actor object (nice for UI attribution).
 * Safe fallback to null.
 */
export async function getActor(id: string) {
  try {
    const res = await fetch(id, {
      headers: { Accept: "application/activity+json" },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/**
 * THREADS
 * Backend now indexes threads in Postgres and returns ThreadStats rows.
 */
export async function getThreadsByGroup(groupIRI: string): Promise<ThreadStats[]> {
  const qs = new URLSearchParams({ groupIRI });
  const data = await apiFetch<{ ok: boolean; items: ThreadStats[] }>(`/threads?${qs.toString()}`);
  return data.items ?? [];
}

/**
 * Fetch all notes belonging to a thread (threadId is the root note IRI).
 * This is your server-renderable local view (not a remote crawl).
 */
export async function getThread(threadId: string): Promise<ThreadResponse> {
  const data = await apiFetch<ThreadResponse>(`/thread/${encodeURIComponent(threadId)}`);
  return data;
}

/**
 * Convenience: just return notes array.
 */
export async function getThreadPosts(threadId: string): Promise<NoteObject[]> {
  const { notes } = await getThread(threadId);
  return Array.isArray(notes) ? notes : [];
}

/**
 * Create a new thread in a group.
 * Backend expects { title, groupContext } and returns { ok, noteId }.
 */
export async function createThread(params: {
  title: string;
  groupContext: string;
}): Promise<{ noteId: string }> {
  const data = await apiFetch<{ ok: boolean; noteId: string }>(`/thread`, {
    method: "POST",
    body: JSON.stringify(params),
  });
  return { noteId: data.noteId };
}

/**
 * POSTS
 */
export async function createPost(params: {
  content: string;
  context?: string;     // group context (optional for your backend)
  inReplyTo?: string;   // parent note id
  to?: string[];
  cc?: string[];
}): Promise<{ noteId: string; activityId?: string }> {
  const data = await apiFetch<{ ok: boolean; noteId: string; activityId?: string }>(`/post`, {
    method: "POST",
    body: JSON.stringify(params),
  });

  return { noteId: data.noteId, activityId: data.activityId };
}

/**
 * Small helpers for UI rendering
 */
export function idFromIri(iri: string): string | null {
  if (!iri || typeof iri !== "string") return null;

  try {
    // Strip query + hash
    const clean = iri.split("#")[0].split("?")[0];

    // Remove trailing slash
    const trimmed = clean.endsWith("/")
      ? clean.slice(0, -1)
      : clean;

    const parts = trimmed.split("/");
    const last = parts[parts.length - 1];

    return last || null;
  } catch {
    return null;
  }
}

export function noteAuthorIri(note: NoteObject): string | null {
  return iriFromValue(note.attributedTo);
}

export function noteInReplyToIri(note: NoteObject): string | null {
  return iriFromValue(note.inReplyTo);
}

export function notePublished(note: NoteObject): string | null {
  return typeof note.published === "string" ? note.published : null;
}

export function noteDepth(note: NoteObject): number {
  const d = note._local?.depth;
  return typeof d === "number" ? d : 0;
}
