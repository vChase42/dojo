"use client";

import { useState } from "react";

import "./graph.css";

import { AnalyzerSelection } from "./components/AnalyzerSelection";
import { RankerSelection } from "./components/RankerSelection";

export default function GraphPage() {
    const [selectedAnalyzers, setSelectedAnalyzers] = useState(
        () => new Set<string>()
    );

    const [selectedRankers, setSelectedRankers] = useState(
        () => new Set<string>()
    );

    const [view, setView] = useState<"observations" | "ranked">(
        "observations"
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
                Developer Graph View
            </h1>

            <div className="graph-controls">
                <section className="graph-panel">
                    <div className="graph-section">
                        <div className="graph-section-title">
                            Analysis
                        </div>

                        <AnalyzerSelection
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

                            {/* TODO */}
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