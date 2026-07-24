// src/conversation/conversationEngine.ts

import {
  Analyzer,
  Observation,
  Ranker,
  RankingResult,
  ThreadSnapshot,
} from "./core/types";

import { ThreadSnapshotService } from "./core/threadSnapshotService";
import { ObservationRepository } from "./persistence/observationRepository";
import { RankingRepository } from "./persistence/rankingRepository";

export class ConversationEngine {
  constructor(
    private snapshots: ThreadSnapshotService,
    private observations: ObservationRepository,
    private rankings: RankingRepository
  ) {}

  // Build a complete snapshot of the canonical conversation.
  async getSnapshot(threadId: string): Promise<ThreadSnapshot> {
    return this.snapshots.load(threadId);
  }

  // Run analyzers in order. Later analyzers can see observations
  // produced by earlier analyzers in the same run.
  async analyze(
    threadId: string,
    analyzers: Analyzer[]
  ): Promise<Observation[]> {
    const snapshot = await this.getSnapshot(threadId);

    const observations: Observation[] = [];

    for (const analyzer of analyzers) {
      const produced = await analyzer.analyze({
        snapshot,
        observations,
      });

      observations.push(...produced);
    }

    await this.observations.saveAll({
      threadId,
      observations,
    });

    return observations;
  }

  // Rank using already-computed observations.
  async rank(
    threadId: string,
    ranker: Ranker
  ): Promise<RankingResult> {
    const snapshot = await this.getSnapshot(threadId);

    const observations =
      await this.observations.getForThread(threadId);

    const result = await ranker.rank({
      snapshot,
      observations,
    });

    await this.rankings.save(result);

    return result;
  }

  // Convenience pipeline for analyzing and immediately ranking.
  async process(params: {
    threadId: string;
    analyzers: Analyzer[];
    rankers?: Ranker[];
  }): Promise<{
    snapshot: ThreadSnapshot;
    observations: Observation[];
    rankings: RankingResult[];
  }> {
    const snapshot = await this.getSnapshot(params.threadId);

    const observations: Observation[] = [];

    for (const analyzer of params.analyzers) {
      const produced = await analyzer.analyze({
        snapshot,
        observations,
      });

      observations.push(...produced);
    }

    await this.observations.saveAll({
      threadId: params.threadId,
      observations,
    });

    const rankings: RankingResult[] = [];

    for (const ranker of params.rankers ?? []) {
      const result = await ranker.rank({
        snapshot,
        observations,
      });

      rankings.push(result);
    }

    await this.rankings.saveAll(rankings);

    return {
      snapshot,
      observations,
      rankings,
    };
  }
}