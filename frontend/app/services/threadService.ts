// app/services/threadService.ts

export interface Thread {
  id: string;
  name: string;
  attributedTo?: string;
  created?: string;
  totalItems?: number;
  slug: string;
}

export interface Post {
  id: string;
  content: string;
  attributedTo: string;
  created?: string;
  inReplyTo?: string;
  [key: string]: any;
}

const API_BASE = "/api";

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
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
 * THREADS
 */
// src/services/activitypubService.t


export async function getThreadPosts(threadId: string): Promise<Post[]> {
  const thread = await getThread(threadId);
  if (!thread) return [];

  const items =
    thread.orderedItems ??
    thread.items ??
    [];

  if (!Array.isArray(items)) return [];

  const fetches = items.map(async (iri) => {
    if (typeof iri !== "string") return null;

    try {
      const res = await fetch(iri, {
        headers: {
          Accept: "application/activity+json",
        },
      });

      if (!res.ok) return null;

      const obj = await res.json();
      const note = Array.isArray(obj) ? obj[0] : obj;

      if (!note || note.type !== "Note") return null;

      return {
        id: note.id,
        content: note.content ?? "",
        attributedTo: note.attributedTo ?? null,
        created: note.published ?? null,
        inReplyTo: note.inReplyTo ?? null,
        context: note.context ?? null,
      } satisfies Post;
    } catch {
      return null;
    }
  });

  const results = await Promise.all(fetches);

  // Preserve order, drop nulls
  return results.filter(Boolean) as Post[];
}


export async function getThreads(): Promise<Thread[]> {
  const data = await apiFetch<{ items: Thread[] }>("/threads");
  return data.items;
}

export async function getThread(id: string): Promise<any> {
  // returns the thread object (OrderedCollection-ish)
  const data = await apiFetch<{ thread: any }>(`/thread/${id}`);
  return data.thread;
}

export async function createThread(
  title: string,
  slug?: string
): Promise<{ threadId: string }> {
  return apiFetch("/thread", {
    method: "POST",
    body: JSON.stringify({ title, slug }),
  });
}



/**
 * POSTS
 */

export async function createPost(params: {
  content: string;
  context?: string;
  inReplyTo?: string;
  to?: string[];
  cc?: string[];
}): Promise<{ noteId: string; activityId?: string }> {
  return apiFetch("/post", {
    method: "POST",
    body: JSON.stringify(params),
  });
}
