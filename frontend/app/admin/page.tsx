"use client";

import { useState } from "react";

import "./admin.css";
import { ThreadGraph } from "./components/ThreadGraph";
import { ThreadForm } from "./components/ThreadForm";

export default function AdminPage() {
  // ---------------------------------------------------------------------------
  // Conversation analysis
  // ---------------------------------------------------------------------------

  const [threadId, setThreadId] = useState("");
  const [analysisLoading, setAnalysisLoading] = useState(false);

  // TODO
  const [graph, setGraph] = useState<any>(null);

  async function handleAnalyze() {
    setAnalysisLoading(true);

    try {
      await fetch("/api/dev/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          threadId,
        }),
      });

      const graph = await fetch(
        `/api/dev/thread/${threadId}/graph`
      ).then((r) => r.json());

      setGraph(graph);
    } finally {
      setAnalysisLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Group creation
  // ---------------------------------------------------------------------------

  const [groupName, setGroupName] = useState("");
  const [summary, setSummary] = useState("");

  const [loading, setLoading] = useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [success, setSuccess] =
    useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const res = await fetch("/api/group", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          groupName,
          summary,
        }),
      });

      const data =
        await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          data?.error || "Failed to create group"
        );
      }

      setSuccess("Group created successfully");

      setGroupName("");
      setSummary("");
    } catch (err: any) {
      setError(
        err.message || "Something went wrong"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="admin-page">
      <div className="admin-header">
        <h1>Admin Panel</h1>

        <p>
          Internal development tools.
        </p>
      </div>

      <ThreadForm
        threadId={threadId}
        loading={analysisLoading}
        onThreadIdChange={setThreadId}
        onAnalyze={handleAnalyze}
      />
      <ThreadGraph graph={graph} />

      {/* ThreadGraph goes here */}

      <div
        style={{
          height: 32,
        }}
      />

      <div className="admin-card">
        <h2>Create Group</h2>

        <form
          className="admin-form"
          onSubmit={handleSubmit}
        >
          <div className="form-row">
            <label htmlFor="groupName">
              Group Name
            </label>

            <input
              id="groupName"
              type="text"
              value={groupName}
              onChange={(e) =>
                setGroupName(e.target.value)
              }
              required
            />
          </div>

          <div className="form-row">
            <label htmlFor="summary">
              Summary
            </label>

            <input
              id="summary"
              type="text"
              value={summary}
              onChange={(e) =>
                setSummary(e.target.value)
              }
            />
          </div>

          <div className="form-actions">
            <button
              type="submit"
              disabled={loading}
            >
              {loading
                ? "Creating…"
                : "Create Group"}
            </button>
          </div>
        </form>

        {error && (
          <div className="form-error">
            {error}
          </div>
        )}

        {success && (
          <div className="form-success">
            {success}
          </div>
        )}
      </div>
    </main>
  );
}