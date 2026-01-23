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
