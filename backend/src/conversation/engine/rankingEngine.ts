// src/conversation/rankingEngine.ts

import { Pool } from "pg";

import {
  Ranker,
  RankingResult,
  ThreadSnapshot,
} from "../core/types";

import { ThreadSnapshotService } from "../core/threadSnapshotService";
import { PostgresObservationQuery } from "../persistence/postgresObservationQuery";

export class RankingEngine {
  constructor(
    private readonly snapshots: ThreadSnapshotService,
    private readonly pg: Pool
  ) {}

  async getSnapshot(
    threadId: string
  ): Promise<ThreadSnapshot> {
    return this.snapshots.load(threadId);
  }

  async rank(
    threadId: string,
    ranker: Ranker
  ): Promise<RankingResult> {
    const snapshot =
      await this.getSnapshot(threadId);

    const observations =
      new PostgresObservationQuery(
        this.pg,
        threadId
      );

    return ranker.rank({
      snapshot,
      observations,
    });
  }
}