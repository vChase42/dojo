// app/threads/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getThreadsByGroup,
  createThread,
  ThreadStats,
  idFromIri,
} from "../services/threadService";

export default function ThreadsPage() {
  const [threads, setThreads] = useState<ThreadStats[]>([]);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true); // start true
  const groupIri = "https://localhost/u/default";

  async function loadThreads() {
    setLoading(true);
    try {
      const items = await getThreadsByGroup(groupIri);
      setThreads(items);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadThreads();
  }, []);

  async function handleCreateThread(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      setLoading(true);
      await createThread({ title, groupContext: groupIri });
      setTitle("");
      await loadThreads();
    } catch (err) {
      console.error("Failed to create thread", err);
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ marginBottom: "1rem" }}>Threads</h1>

      {/* Create Thread Form */}
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

      {/* Table Wrapper */}
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
              {threads.map((thread) => (
                <tr key={thread.rootNoteIri}>
                  <td style={{ padding: "6px 0" }}>
                    <Link
                      href={`/threads/${idFromIri(
                        thread.rootNoteIri
                      )}`}
                      style={{ textDecoration: "none" }}
                    >
                      {thread.title}
                    </Link>
                  </td>
                  <td style={{ padding: "6px 0", color: "#666" }}>
                    {thread.creatorIri ?? "unknown"}
                  </td>
                  <td
                    style={{
                      padding: "6px 0",
                      textAlign: "right",
                    }}
                  >
                    {thread.replyCount ?? 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Loading Overlay */}
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
