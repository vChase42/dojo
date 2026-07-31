"use client";

import { useEffect, useMemo, useState } from "react";

import "./graph.css";

import type {
  AnalyzerDescriptor,
  ObservationFilterState,
} from "./types";
import { useParams } from "next/navigation";

import { getAnalyzers } from "@/app/services/devService";

import { AnalyzerSelection } from "./components/AnalyzerSelection";
import { ObservationFilters } from "./components/ObservationFilters";
import { RankerSelection } from "./components/RankerSelection";

function threadIdFromParam(id: string): string {
  id = decodeURIComponent(id);
  if (
    id.startsWith("http") ||
    id.startsWith("reddit:")
  ) {
    return id;
  }

  return `https://localhost/o/${id}`;
}

export default function GraphPage() {
  const params = useParams();

  const shortId =
    typeof params.id === "string"
      ? params.id
      : Array.isArray(params.id)
      ? params.id[0]
      : null;

    const [analyzers, setAnalyzers] = useState<    AnalyzerDescriptor[]>([]);

    const [selectedAnalyzers, setSelectedAnalyzers] = useState(    () => new Set<string>());

    const [selectedRankers, setSelectedRankers] = useState(    () => new Set<string>());

    const [view, setView] = useState<"observations" | "ranked">("observations");

    const [filters, setFilters] = useState<ObservationFilterState>({
        subject: "post",
        types: [],

        showAuthor: true,
        showContent: true,
        showEmpty: false,
    });

    const [threadId, setThreadId] = useState<string>("");

    useEffect(() => {
        setThreadId(threadIdFromParam(shortId!));
        getAnalyzers()
            .then(setAnalyzers)
            .catch(console.error);
    }, []);

    const observationTypes = useMemo(
        () =>
            Array.from(
                new Set(
                    analyzers
                        .filter(analyzer =>
                            selectedAnalyzers.has(analyzer.id)
                        )
                        .flatMap(
                            analyzer => analyzer.observationTypes
                        )
                )
            ),
        [analyzers, selectedAnalyzers]
    );

    async function analyze() {
        console.log(
            "Analyze:",
            Array.from(selectedAnalyzers)
        );

        // TODO
    }

    return (
        <main className="forum graph-page">
            <h1 className="graph-title">
                Developer Graph View for thread: {threadId}
            </h1>

            <div className="graph-controls">
                <section className="graph-panel">
                    <div className="graph-section">
                        <div className="graph-section-title">
                            Analysis
                        </div>

                        <AnalyzerSelection
                            analyzers={analyzers}
                            selected={selectedAnalyzers}
                            onChange={setSelectedAnalyzers}
                            onAnalyze={analyze}
                        />
                    </div>
                </section>

                <section className="graph-panel">
                    <div className="graph-section">
                        <div className="graph-section-title">
                            View
                        </div>

                        <div className="graph-list">
                            <label>
                                <input
                                    type="radio"
                                    checked={view === "observations"}
                                    onChange={() =>
                                        setView("observations")
                                    }
                                />
                                Observations
                            </label>

                            <label>
                                <input
                                    type="radio"
                                    checked={view === "ranked"}
                                    onChange={() =>
                                        setView("ranked")
                                    }
                                />
                                Ranked
                            </label>
                        </div>
                    </div>
                </section>

                {view === "observations" && (
                    <section className="graph-panel">
                        <div className="graph-section">
                            <div className="graph-section-title">
                                Observation Filters
                            </div>

                            <ObservationFilters
                                types={observationTypes}
                                filters={filters}
                                onChange={setFilters}
                            />
                        </div>
                    </section>
                )}

                {view === "ranked" && (
                    <section className="graph-panel">
                        <div className="graph-section">
                            <div className="graph-section-title">
                                Ranking
                            </div>

                            <RankerSelection
                                selected={selectedRankers}
                                onChange={setSelectedRankers}
                            />
                        </div>
                    </section>
                )}
            </div>

            <section className="graph-render">
                {view === "observations" ? (
                    <>Observation Tree</>
                ) : (
                    <>Ranked Posts</>
                )}
            </section>
        </main>
    );
}