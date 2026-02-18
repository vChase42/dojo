"use client";

import { useState } from "react";
import "./admin.css";

export default function AdminPage() {
  const [groupName, setGroupName] = useState("");
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const res = await fetch("/api/group", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupName, summary }),
      });

      const text = await res.text();

      if (!res.ok) {
        throw new Error(text || "Failed to create group");
      }

      const data = JSON.parse(text);

      setSuccess(`Group created successfully`);
      setGroupName("");
      setSummary("");
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="admin-page">
      <div className="admin-header">
        <h1>Admin Panel</h1>
        <p>Create and manage site-level resources.</p>
      </div>

      <div className="admin-card">
        <h2>Create Group</h2>

        <form className="admin-form" onSubmit={handleSubmit}>
          <div className="form-row">
            <label htmlFor="groupName">Group Name</label>
            <input
              id="groupName"
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              required
            />
          </div>

          <div className="form-row">
            <label htmlFor="summary">Summary</label>
            <input
              id="summary"
              type="text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </div>

          <div className="form-actions">
            <button type="submit" disabled={loading}>
              {loading ? "Creating…" : "Create Group"}
            </button>
          </div>
        </form>

        {error && <div className="form-error">{error}</div>}
        {success && <div className="form-success">{success}</div>}
      </div>
    </main>
  );
}
