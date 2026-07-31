"use client";

import type { AnalyzerDescriptor } from "../types";

type AnalyzerSelectionProps = {
    analyzers: AnalyzerDescriptor[];
    selected: Set<string>;
    onChange(selected: Set<string>): void;
    onAnalyze(): void;
};

export function AnalyzerSelection({
    analyzers,
    selected,
    onChange,
    onAnalyze,
}: AnalyzerSelectionProps) {
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
<>
    <p className="graph-callout">
        Select one or more analyzers, then run them to generate observations.
    </p>

    <div className="graph-list graph-analyzer-list">
        {analyzers.map(analyzer => (
            <label key={analyzer.id}>
                <input
                    type="checkbox"
                    checked={selected.has(analyzer.id)}
                    onChange={() => toggle(analyzer.id)}
                />

                {analyzer.name}
            </label>
        ))}
    </div>

    <div className="graph-actions">
        <button
            className="graph-primary-button"
            type="button"
            onClick={onAnalyze}
        >
            Analyze Thread
        </button>
    </div>
</>
    );
}