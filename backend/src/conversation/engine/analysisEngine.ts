// src/conversation/analysisEngine.ts

import { Pool } from "pg";

import {
  Analyzer,
  Observation,
  ThreadSnapshot,
} from "../core/types";

import { ThreadSnapshotService } from "../core/threadSnapshotService";
import { ObservationRepository } from "../persistence/observationRepository";
import { PostgresObservationQuery } from "../persistence/postgresObservationQuery";

export class AnalysisEngine {
  constructor(
    private readonly snapshots: ThreadSnapshotService,
    private readonly observations: ObservationRepository,
    private readonly pg: Pool
  ) {}

  async getSnapshot(
    threadId: string
  ): Promise<ThreadSnapshot> {
    return this.snapshots.load(threadId);
  }

  async analyze(
    threadId: string,
    analyzers: Analyzer[]
  ): Promise<Observation[]> {
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