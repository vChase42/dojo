// app/threads/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getThreadsByGroup,
  createThread,
} from "../services/threadsService";
import { Pagination, Thread } from "../types";

function idFromIri(iri: string): string | null {
  if (!iri) return null;

  try {
    const clean = iri.split("#")[0].split("?")[0];
    const trimmed = clean.endsWith("/") ? clean.slice(0, -1) : clean;
    const parts = trimmed.split("/");
    return parts[parts.length - 1] || null;
  } catch {
    return null;
  }
}

export default function ThreadsPage() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const limit = 50;

  const groupIri = "https://localhost/u/default";

  async function loadThreads(nextPage = page) {
    setLoading(true);

    try {
      const result = await getThreadsByGroup({
        groupIRI: groupIri,
        page: nextPage,
        limit,
      });

      setThreads(result.items);
      setPagination(result.pagination);
      setPage(nextPage);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadThreads(1);
  }, []);

  async function handleCreateThread(e: React.FormEvent) {
    e.preventDefault();

    if (!title.trim()) return;

    try {
      setLoading(true);
      await createThread({ title, groupContext: groupIri });
      setTitle("");
      await loadThreads(1);
    } catch (err) {
      console.error("Failed to create thread", err);
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ marginBottom: "1rem" }}>Threads</h1>

      <form
        onSubmit={handleCreateThread}
        style={{
          display: "flex",
          gap: "0.5rem",
          marginBottom: "1.5rem",
          background: "#BBBBBB",
        }}
      >
        <input
          type="text"
          placeholder="Thread title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ flex: 1, padding: "0.4rem" }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{ padding: "0.4rem 0.8rem" }}
        >
          Create
        </button>
      </form>

      <div style={{ position: "relative", minHeight: 120 }}>
        {!loading && threads.length === 0 && (
          <p>No threads yet.</p>
        )}

        {threads.length > 0 && (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontFamily: "monospace",
            }}
          >
            <thead>
              <tr>
                <th style={{ textAlign: "left", paddingBottom: 8 }}>
                  Topic
                </th>
                <th style={{ textAlign: "left", paddingBottom: 8 }}>
                  Author
                </th>
                <th style={{ textAlign: "right", paddingBottom: 8 }}>
                  Replies
                </th>
              </tr>
            </thead>

            <tbody>
              {threads.map((thread) => {
                const threadSlug = idFromIri(thread.id);

                return (
                  <tr key={thread.id}>
                    <td style={{ padding: "6px 0" }}>
                      <Link
                        href={`/threads/${threadSlug}`}
                        style={{ textDecoration: "none" }}
                      >
                        {thread.title}
                      </Link>
                    </td>

                    <td style={{ padding: "6px 0", color: "#666" }}>
                      {thread.creatorIri ?? "unknown"}
                    </td>

                    <td style={{ padding: "6px 0", textAlign: "right" }}>
                      {thread.replyCount ?? 0}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {pagination && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: "1rem",
              fontFamily: "monospace",
            }}
          >
            <button
              type="button"
              disabled={loading || !pagination.hasPreviousPage}
              onClick={() => loadThreads(page - 1)}
            >
              Previous
            </button>

            <span>
              Page {pagination.page} of {pagination.totalPages || 1}
            </span>

            <button
              type="button"
              disabled={loading || !pagination.hasNextPage}
              onClick={() => loadThreads(page + 1)}
            >
              Next
            </button>
          </div>
        )}

        {loading && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(200, 200, 200, 0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 500,
              fontSize: "1rem",
            }}
          >
            Loading...
          </div>
        )}
      </div>
    </main>
  );
}