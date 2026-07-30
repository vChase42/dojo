// app/admin/components/ThreadForm.tsx

interface ThreadFormProps {
  threadId: string;
  loading: boolean;

  onThreadIdChange(threadId: string): void;
  onAnalyze(): void;
}

export function ThreadForm({
  threadId,
  loading,

  onThreadIdChange,
  onAnalyze,
}: ThreadFormProps) {
  return (
    <div className="admin-card">
      <h2>Conversation Analysis</h2>

      <div className="admin-form">
        <div className="form-row">
          <label htmlFor="threadId">Thread ID</label>

          <input
            id="threadId"
            type="text"
            placeholder="Thread ID..."
            value={threadId}
            onChange={(e) => onThreadIdChange(e.target.value)}
          />
        </div>

        <div className="form-actions">
          <button
            type="button"
            disabled={loading || threadId.trim() === ""}
            onClick={onAnalyze}
          >
            {loading ? "Analyzing…" : "Analyze"}
          </button>
        </div>
      </div>
    </div>
  );
}