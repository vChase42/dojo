// app/services/threadsService.ts

import {
  Thread,
  Post,
  ThreadWithPosts,
  ThreadsResponse,
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

export async function getThreadsByGroup(params: {
  groupIRI: string;
  page?: number;
  limit?: number;
}): Promise<ThreadsResponse> {
  const qs = new URLSearchParams({
    groupIRI: params.groupIRI,
    page: String(params.page ?? 1),
  });

  if (params.limit !== undefined) {
    qs.set("limit", String(params.limit));
  }

  return apiFetch<ThreadsResponse>(
    `/threads?${qs.toString()}`
  );
}

export async function getThread(params: {
  threadId: string;
  page?: number;
  limit?: number;
}): Promise<ThreadWithPosts> {
  const qs = new URLSearchParams({
    page: String(params.page ?? 1),
  });

  if (params.limit !== undefined) {
    qs.set("limit", String(params.limit));
  }

  return apiFetch<ThreadWithPosts>(
    `/thread/${encodeURIComponent(params.threadId)}?${qs.toString()}`
  );
}

/**
 * Create a new thread/root post.
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

export async function deletePost(params: {
  noteIri: string;
  reason?: string;
}): Promise<Post> {
  const data = await apiFetch<{ ok: boolean; post: Post }>(
    `/deletepost`,
    {
      method: "POST",
      body: JSON.stringify(params),
    }
  );

  return data.post;
}

export async function votePost(params: {
  noteIri: string;
  value: -1 | 0 | 1;
}): Promise<Post> {
  const data = await apiFetch<{ ok: boolean; post: Post }>(
    `/votepost`,
    {
      method: "POST",
      body: JSON.stringify(params),
    }
  );

  return data.post;
}