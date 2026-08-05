"use client";

import { useEffect, useMemo, useState } from "react";

import "./graph.css";

import type {
  AnalyzerDescriptor,
  GraphViewMode,
  ObservationFilterState,
  ObservationGraph,
} from "./types";

import { useParams } from "next/navigation";

import {
  analyze as runAnalysis,
  getAnalyzers,
  getGraph,
  getObservations,
} from "@/app/services/devService";

import { AnalyzerSelection } from "./components/AnalyzerSelection";
import { GraphTree } from "./components/tree/GraphTree";
import { ObservationFilters } from "./components/ObservationFilters";
import { RankerSelection } from "./components/RankerSelection";
import { buildObservationGraph } from "./components/tree/tree";

function threadIdFromParam(id: string): string {
  id = decodeURIComponent(id);

  if (id.startsWith("http") || id.startsWith("reddit:")) {
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

  const [threadId, setThreadId] = useState("");

  const [graphDto, setGraphDto] = useState<any>(null);
  const [graph, setGraph] = useState<ObservationGraph | null>(null);

  const [analyzers, setAnalyzers] = useState<AnalyzerDescriptor[]>([]);
  const [selectedAnalyzers, setSelectedAnalyzers] = useState(() => new Set<string>());
  const [selectedRankers, setSelectedRankers] = useState(() => new Set<string>());

  const [view, setView] = useState<GraphViewMode>("observations");

  const [filters, setFilters] = useState<ObservationFilterState>({
    types: [],

    includeThread: true,
    includePosts: true,
    includeEdges: true,
    includeParticipants: true,
    includeBranches: true,

    showAuthor: true,
    showContent: true,
    showEmpty: false,
  });

  useEffect(() => {
    const threadId = threadIdFromParam(shortId!);

    setThreadId(threadId);

    Promise.all([
      getAnalyzers(),
      getGraph(threadId),
    ])
      .then(([analyzers, graph]) => {
        setAnalyzers(analyzers);
        setGraphDto(graph);
        setGraph(buildObservationGraph(graph as any, []));
      })
      .catch(console.error);
  }, []);

  const observationTypes = useMemo(
    () =>
      Array.from(
        new Set(
          analyzers
            .filter(analyzer => selectedAnalyzers.has(analyzer.id))
            .flatMap(analyzer => analyzer.observationTypes)
        )
      ),
    [analyzers, selectedAnalyzers]
  );

  async function analyze() {
    const analyzerIds = Array.from(selectedAnalyzers);

    await runAnalysis(threadId, analyzerIds);

    const observations = await getObservations(threadId, analyzerIds);

    setGraph(
      buildObservationGraph(
        graphDto,
        observations
      )
    );
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

            <div className="graph-list-horizontal">
              <label>
                <input
                  type="radio"
                  checked={view === "observations"}
                  onChange={() => setView("observations")}
                />
                <span className="pl-1">
                  Observations
                </span>
              </label>

              <label>
                <input
                  type="radio"
                  checked={view === "ranked"}
                  onChange={() => setView("ranked")}
                />
                <span className="pl-1">
                  Ranked
                </span>
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
        {view === "observations" && graph
          ? <GraphTree graph={graph} filters={filters} />
          : <>Ranked Posts</>}
      </section>

      <section className="p-4">
        <div style={{ fontSize: 30 }}>
          End of Page
        </div>
      </section>
    </main>
  );
}