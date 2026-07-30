"use client";

import { useEffect, useState } from "react";

import { getRankers } from "@/app/services/devService";
import type { RankerDescriptor } from "../types";

type RankerSelectionProps = {
  selected: Set<string>;
  onChange(selected: Set<string>): void;
};

export function RankerSelection({
  selected,
  onChange,
}: RankerSelectionProps) {
  const [rankers, setRankers] = useState<RankerDescriptor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    getRankers()
      .then(setRankers)
      .catch((e) => {
        setError(
          e instanceof Error
            ? e.message
            : "Failed to load rankers."
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
      <h2>Ranking</h2>

      {loading && <p>Loading rankers...</p>}

      {error && (
        <p style={{ color: "var(--danger)" }}>{error}</p>
      )}

      {!loading &&
        rankers.map((ranker) => (
          <label
            key={ranker.id}
            style={{
              display: "block",
              marginBottom: ".4rem",
            }}
          >
            <input
              type="checkbox"
              checked={selected.has(ranker.id)}
              onChange={() => toggle(ranker.id)}
            />{" "}
            {ranker.name}
          </label>
        ))}
    </section>
  );
}