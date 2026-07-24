// src/conversation/engine/analysisEngine.ts

import {
  Analyzer,
  AnalysisRunResult,
  AnalyzerRunSummary,
  Observation,
  ObservationSubjectType,
} from "../core/types";

import { ThreadSnapshotService } from "../core/threadSnapshotService";
import { ObservationRepository } from "../persistence/observationRepository";

export class AnalysisEngine {
  constructor(
    private snapshots: ThreadSnapshotService,
    private observationRepository: ObservationRepository
  ) {}

  async run(params: {
    threadId: string;
    analyzers: Analyzer[];
  }): Promise<AnalysisRunResult> {
    const startedAt = Date.now();

    const snapshot = await this.snapshots.load(params.threadId);

    const observations: Observation[] = [];
    const analyzerSummaries: AnalyzerRunSummary[] = [];

    for (const analyzer of params.analyzers) {
      const analyzerStartedAt = Date.now();

      const produced = await analyzer.analyze({
        snapshot,
        observations,
      });

      observations.push(...produced);

      await this.observationRepository.saveAll({
        threadId: params.threadId,
        observations: produced,
      });

      analyzerSummaries.push({
        analyzerId: analyzer.id,
        analyzerVersion: analyzer.version,
        observationCount: produced.length,
        durationMs: Date.now() - analyzerStartedAt,
      });
    }

    return {
      threadId: params.threadId,

      observations,

      summary: {
        analyzerCount: params.analyzers.length,
        observationCount: observations.length,

        subjects: this.countSubjects(observations),

        analyzers: analyzerSummaries,

        durationMs: Date.now() - startedAt,
      },
    };
  }

  private countSubjects(
    observations: Observation[]
  ): Partial<Record<ObservationSubjectType, number>> {
    const counts: Partial<
      Record<ObservationSubjectType, number>
    > = {};

    for (const observation of observations) {
      const type = observation.subject.type;

      counts[type] = (counts[type] ?? 0) + 1;
    }

    return counts;
  }
}