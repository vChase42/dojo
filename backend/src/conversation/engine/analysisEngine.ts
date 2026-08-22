// src/conversation/engine/analysisEngine.ts

import { Pool } from "pg";

import {
  AnalyzerContext,
  Observation,
  Ranker,
  ThreadSnapshot,
} from "../core/types";

import { analyzers, analyzerMap } from "../analyzers";
import { rankers } from "../rankers";

import { ThreadSnapshotService } from "../core/threadSnapshotService";
import { PostgresObservationQuery } from "../persistence/postgresObservationQuery";
import { ObservationRepository } from "../persistence/observationRepository";

export class AnalysisEngine {
  constructor(
    private readonly snapshots: ThreadSnapshotService,
    private readonly repository: ObservationRepository,
    private readonly pg: Pool
  ) {}

  getAnalyzers() {
    return analyzers;
  }

  getRankers(): Ranker[] {
    return rankers;
  }

  getObservationTypes(): string[] {
    return [...new Set(analyzers.flatMap(analyzer => analyzer.observationTypes))].sort();
  }

  async getSnapshot(threadId: string): Promise<ThreadSnapshot> {
    return this.snapshots.load(threadId);
  }

  async analyze(
    threadId: string,
    analyzerIds: string[]
  ): Promise<Observation[]> {
    const snapshot = await this.getSnapshot(threadId);
    const observationQuery = new PostgresObservationQuery(this.pg, threadId);

    const context: AnalyzerContext = {
      snapshot,
      observations: new Map(),
    };

    for (const analyzerId of analyzerIds) {
      await this.analyzeRecursive(analyzerId, threadId, context, observationQuery);
    }

    return analyzerIds.flatMap(analyzerId => context.observations.get(analyzerId) ?? []);
  }

  private async analyzeRecursive(
    analyzerId: string,
    threadId: string,
    context: AnalyzerContext,
    observationQuery: PostgresObservationQuery
  ): Promise<Observation[]> {
    const cached = context.observations.get(analyzerId);

    if (cached) {
      return cached;
    }

    const analyzer = analyzerMap.get(analyzerId);

    if (!analyzer) {
      throw new Error(`Unknown analyzer '${analyzerId}'.`);
    }

    for (const dependency of analyzer.dependsOn) {
      await this.analyzeRecursive(dependency, threadId, context, observationQuery);
    }

    const existing = await observationQuery.list({
      analyzerId,
      analyzerVersion: analyzer.version,
    });

    if (existing.length > 0) {
      context.observations.set(analyzerId, existing);
      return existing;
    }

    const observations = await analyzer.analyze(context);

    await this.repository.saveAll({
      threadId,
      observations,
    });

    context.observations.set(analyzerId, observations);

    return observations;
  }
}