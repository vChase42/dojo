"use client";

import { useEffect, useState } from "react";

import { getAnalyzers } from "@/app/services/devService";
import type { AnalyzerDescriptor } from "../types";

type AnalyzerSelectionProps = {
  selected: Set<string>;
  onChange(selected: Set<string>): void;
  onAnalyze(): void;
};

export function AnalyzerSelection({
  selected,
  onChange,
  onAnalyze,
}: AnalyzerSelectionProps) {
  const [analyzers, setAnalyzers] = useState<AnalyzerDescriptor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    getAnalyzers()
      .then(setAnalyzers)
      .catch((e) => {
        setError(
          e instanceof Error
            ? e.message
            : "Failed to load analyzers."
        );
      })
      .finally(() => setLoading(false));
  }, []);

  function toggle(id: string) {
    const next = new Set(selected);

    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }

    onChange(next);
  }

  return (
    <section className="graph-panel">
      <h2>Analysis</h2>

      {loading && <p>Loading analyzers...</p>}

      {error && (
        <p style={{ color: "var(--danger)" }}>{error}</p>
      )}

      {!loading &&
        analyzers.map((analyzer) => (
          <label
            key={analyzer.id}
            style={{
              display: "block",
              marginBottom: ".4rem",
            }}
          >
            <input
              type="checkbox"
              checked={selected.has(analyzer.id)}
              onChange={() => toggle(analyzer.id)}
            />{" "}
            {analyzer.name}
          </label>
        ))}

      <div style={{ marginTop: "1rem" }}>
        <button
          type="button"
          onClick={onAnalyze}
          disabled={loading}
        >
          Analyze
        </button>
      </div>
    </section>
  );
}