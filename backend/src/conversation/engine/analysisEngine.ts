// src/conversation/analysisEngine.ts

import { Pool } from "pg";

import {
  Analyzer,
  Observation,
  Ranker,
  ThreadSnapshot,
} from "../core/types";

import { ThreadSnapshotService } from "../core/threadSnapshotService";
import { ObservationRepository } from "../persistence/observationRepository";
import { PostgresObservationQuery } from "../persistence/postgresObservationQuery";

import { StructuralAnalyzer } from "../analyzers/structuralAnalyzer";

export class AnalysisEngine {
  private readonly analyzers: Analyzer[] = [
    new StructuralAnalyzer(),
  ];

  private readonly rankers: Ranker[] = [];

  constructor(
    private readonly snapshots: ThreadSnapshotService,
    private readonly observations: ObservationRepository,
    private readonly pg: Pool
  ) {}

  getAnalyzers(): Analyzer[] {
    return this.analyzers;
  }

  getRankers(): Ranker[] {
    return this.rankers;
  }

  getObservationTypes(): string[] {
    return [
      ...new Set(
        this.analyzers.flatMap(
          analyzer => analyzer.observationTypes
        )
      ),
    ].sort();
  }

  async getSnapshot(
    threadId: string
  ): Promise<ThreadSnapshot> {
    return this.snapshots.load(threadId);
  }

  async analyze(
    threadId: string,
    analyzerIds: string[]
  ): Promise<Observation[]> {
    const analyzers = this.analyzers.filter(
      analyzer => analyzerIds.includes(analyzer.id)
    );

    const snapshot = await this.getSnapshot(threadId);

    const observationQuery =
      new PostgresObservationQuery(this.pg, threadId);

    const produced: Observation[] = [];

    for (const analyzer of analyzers) {
      const observations = await analyzer.analyze({
        snapshot,
        observations: observationQuery,
      });

      produced.push(...observations);

      await this.observations.saveAll({
        threadId,
        observations,
      });
    }

    return produced;
  }
}