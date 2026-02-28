// app/services/threadsService.ts

import {
  Thread,
  Post,
  ThreadWithPosts,
} from "@/app/types";

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

export async function getThreadsByGroup(
  groupIRI: string
): Promise<Thread[]> {
  const qs = new URLSearchParams({ groupIRI });
  const data = await apiFetch<{ ok: boolean; items: Thread[] }>(
    `/threads?${qs.toString()}`
  );

  return data.items ?? [];
}

export async function getThread(
  threadId: string
): Promise<ThreadWithPosts> {
  return apiFetch<ThreadWithPosts>(
    `/thread/${encodeURIComponent(threadId)}`
  );
}

/**
 * Create a new thread (root post).
 */
export async function createThread(params: {
  title: string;
  groupContext: string;
}): Promise<{ noteId: string }> {
  const data = await apiFetch<{ ok: boolean; noteId: string }>(
    `/thread`,
    {
      method: "POST",
      body: JSON.stringify(params),
    }
  );

  return { noteId: data.noteId };
}

/**
 * POSTS
 */

export async function createPost(params: {
  content: string;
  context: string;
  inReplyTo?: string;
  to?: string[];
  cc?: string[];
}): Promise<{ noteId: string }> {
  const data = await apiFetch<{ ok: boolean; noteId: string }>(
    `/post`,
    {
      method: "POST",
      body: JSON.stringify(params),
    }
  );

  return { noteId: data.noteId };
}

export async function editPost(params: {
  noteIri: string;
  content: string;
  reason?: string;
}): Promise<Post> {
  const data = await apiFetch<{ ok: boolean; post: Post }>(
    `/editpost`,
    {
      method: "POST",
      body: JSON.stringify(params),
    }
  );

  return data.post;
}