// src/conversation/engine/analysisEngine.ts

import { Pool } from "pg";

import {
  Analyzer,
  AnalyzerContext,
  Observation,
  Ranker,
  ThreadSnapshot,
} from "../core/types";

import { rankers } from "../rankers";

import { ThreadSnapshotService } from "../core/threadSnapshotService";
import { PostgresObservationQuery } from "../persistence/postgresObservationQuery";
import { ObservationRepository } from "../persistence/observationRepository";

import { EmbeddingRepository, EmbeddingModel } from "../persistence/embeddings/types";

import { StructuralAnalyzer } from "../analyzers/structuralAnalyzer";
import { ParticipationAnalyzer } from "../analyzers/participationAnalyzer";
import { TemporalAnalyzerT1 } from "../analyzers/temporalAnalyzerT1";
import { TemporalAnalyzerT2 } from "../analyzers/temporalAnalyzerT2";
import { SemanticPlaygroundEmbeddingAnalyzer } from "../analyzers/semanticTestT1";
import { SemanticSimilarityEmbeddingAnalyzer } from "../analyzers/SemanticTestT2";
import { SemanticTest3 } from "../analyzers/semanticTestT3";
import { SemanticTest4 } from "../analyzers/SemanticTestT4";
import { SemanticTest5 } from "../analyzers/SemanticTestT5";
import { SemanticTest6 } from "../analyzers/SemanticTestT6";
import { SemanticTest7 } from "../analyzers/SemanticTestT7";

export class AnalysisEngine {
  private readonly analyzers: Analyzer[];
  private readonly analyzerMap: Map<string, Analyzer>;

  constructor(
    private readonly snapshots: ThreadSnapshotService,
    private readonly repository: ObservationRepository,
    embeddingRepository: EmbeddingRepository,
    embeddingModel: EmbeddingModel,
    private readonly pg: Pool,
  ) {
    this.analyzers = [
      new StructuralAnalyzer(),
      new ParticipationAnalyzer(),
      new TemporalAnalyzerT1(),
      new TemporalAnalyzerT2(),
      new SemanticPlaygroundEmbeddingAnalyzer(
        embeddingRepository,
        embeddingModel,
      ),
      new SemanticSimilarityEmbeddingAnalyzer(embeddingRepository, embeddingModel),
      new SemanticTest3(embeddingRepository,embeddingModel),
      new SemanticTest4(embeddingRepository,embeddingModel),
      new SemanticTest5(embeddingRepository,embeddingModel),
      new SemanticTest6(embeddingRepository,embeddingModel),
      new SemanticTest7(embeddingRepository,embeddingModel),
    ];

    this.analyzerMap = new Map(
      this.analyzers.map(analyzer => [analyzer.id, analyzer]),
    );
  }

  getAnalyzers(): Analyzer[] {
    return this.analyzers;
  }

  getRankers(): Ranker[] {
    return rankers;
  }

  getObservationTypes(): string[] {
    return [...new Set(
      this.analyzers.flatMap(analyzer => analyzer.observationTypes),
    )].sort();
  }

  async getSnapshot(threadId: string): Promise<ThreadSnapshot> {
    return this.snapshots.load(threadId);
  }

  async analyze(
    threadId: string,
    analyzerIds: string[],
  ): Promise<Observation[]> {
    const snapshot = await this.getSnapshot(threadId);
    const observationQuery = new PostgresObservationQuery(this.pg, threadId);

    const context: AnalyzerContext = {
      snapshot,
      observations: new Map(),
    };

    for (const analyzerId of analyzerIds) {
      await this.analyzeRecursive(
        analyzerId,
        threadId,
        context,
        observationQuery,
      );
    }

    return analyzerIds.flatMap(
      analyzerId => context.observations.get(analyzerId) ?? [],
    );
  }

  private async analyzeRecursive(
    analyzerId: string,
    threadId: string,
    context: AnalyzerContext,
    observationQuery: PostgresObservationQuery,
  ): Promise<Observation[]> {
    const cached = context.observations.get(analyzerId);

    // if (cached) {
    //   return cached;
    // }

    const analyzer = this.analyzerMap.get(analyzerId);

    if (!analyzer) {
      throw new Error(`Unknown analyzer '${analyzerId}'.`);
    }

    for (const dependency of analyzer.dependsOn) {
      await this.analyzeRecursive(
        dependency,
        threadId,
        context,
        observationQuery,
      );
    }

    const existing = await observationQuery.list({
      analyzerId,
      analyzerVersion: analyzer.version,
    });

    // if (existing.length > 0) {
    //   context.observations.set(analyzerId, existing);
    //   return existing;
    // }

    const start = performance.now();
    const observations = await analyzer.analyze(context);
    console.log(`[Analysis] ${analyzer.id} (${analyzer.version}) ${(performance.now() - start).toFixed(1)}ms`);

    await this.repository.saveAll({
      threadId,
      observations,
    });

    context.observations.set(analyzerId, observations);

    return observations;
  }
}