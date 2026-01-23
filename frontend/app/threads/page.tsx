// app/threads/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getThreads, createThread, Thread } from "../services/threadService";

export default function ThreadsPage() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadThreads() {
    const items = await getThreads();
    setThreads(items);
  }

  useEffect(() => {
    loadThreads();
  }, []);

  async function handleCreateThread(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      setLoading(true);
      await createThread(title, slug || undefined);
      setTitle("");
      setSlug("");
      await loadThreads();
    } catch (err) {
      console.error("Failed to create thread", err);
    } finally {
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
          background:'#BBBBBB',
        }}
      >
        <input
          type="text"
          placeholder="Thread title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ flex: 3, padding: "0.4rem" }}
        />
        <input
          type="text"
          placeholder="slug (optional)"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          style={{ flex: 2, padding: "0.4rem" }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{ padding: "0.4rem 0.8rem" }}
        >
          Create
        </button>
      </form>

      {threads.length === 0 ? (
        <p>No threads yet.</p>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontFamily: "monospace",
          }}
        >
          <thead>
            <tr>
              <th style={{ textAlign: "left", paddingBottom: 8 }}>Topic</th>
              <th style={{ textAlign: "left", paddingBottom: 8 }}>Author</th>
              <th style={{ textAlign: "right", paddingBottom: 8 }}>Replies</th>
            </tr>
          </thead>
          <tbody>
            {threads.map((thread) => (
              <tr key={thread.id}>
                <td style={{ padding: "6px 0" }}>
                  <Link
                    href={`/threads/${thread.slug}`}
                    style={{ textDecoration: "none" }}
                  >
                    {thread.name}
                  </Link>
                </td>
                <td style={{ padding: "6px 0", color: "#666" }}>
                  {thread.attributedTo ?? "unknown"}
                </td>
                <td style={{ padding: "6px 0", textAlign: "right" }}>
                  {thread.totalItems ?? 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
