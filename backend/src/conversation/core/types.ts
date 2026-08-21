// src/conversation/core/types.ts

import { Post, Thread } from "../../types";

/* ============================================================================
 * Snapshot
 * ========================================================================== */

export interface ConversationEdge {
  parentId: string;
  childId: string;
}

export interface ThreadSnapshot {
  thread: Thread;
  rootPost: Post;

  posts: Post[];

  postsById: Map<string, Post>;
  childrenByParentId: Map<string, Post[]>;
  edges: ConversationEdge[];

  participants: string[];

  capturedAt: Date;
}

/* ============================================================================
 * Observations
 * ========================================================================== */

export interface ObservationRepository {
  saveAll(params: {
    threadId: string;
    observations: Observation[];
  }): Promise<void>;

  delete(params: {
    threadId: string;

    analyzerId?: string;
    analyzerVersion?: string;

    type?: string;
  }): Promise<void>;
}


export type ObservationSubjectType =
  | "thread"
  | "post"
  | "edge"
  | "participant"
  | "path"
  | "branch";

export interface ObservationSubject {
  type: ObservationSubjectType;
  id: string;
}

/**
 * A single derived fact about a conversation.
 *
 * The `type` field is the stable contract that downstream analyzers and
 * rankers depend on.
 *
 * Examples:
 *  - structure.thread
 *  - structure.post
 *  - branch.summary
 *  - participation.user
 *  - ranking.golden-path
 */
export interface Observation<
  TData extends Record<string, unknown> = Record<string, unknown>
> {
  subject: ObservationSubject;

  type: string;

  analyzerId: string;
  analyzerVersion: string;

  data: TData;

  computedAt: Date;
}

export interface ObservationFilter {
    subjectType?: ObservationSubjectType;
    subjectId?: string;

    type?: string;

    analyzerId?: string;
    analyzerIds?: string[];
    analyzerVersion?: string;
}

/**
 * Read-only access to observations.
 *
 * The backing implementation may query PostgreSQL, cache results in memory,
 * or combine multiple sources. Consumers should never know.
 */
export interface ObservationQuery {
  list(
    filter?: ObservationFilter
  ): Promise<Observation[]>;

  first(
    filter: ObservationFilter
  ): Promise<Observation | null>;

  exists(
    filter: ObservationFilter
  ): Promise<boolean>;
}

/* ============================================================================
 * Analysis
 * ========================================================================== */

export interface AnalyzerContext {
  snapshot: ThreadSnapshot;

  /**
   * Observations produced by analyzers that have already completed during
   * this analysis run.
   */
  observations: Map<string, Observation[]>;
}

export interface Analyzer {
  id: string;
  version: string;

  observationTypes: string[];
  dependsOn: string[];

  analyze(
    context: AnalyzerContext
  ): Promise<Observation[]>;
}

/* ============================================================================
 * Ranking
 * ========================================================================== */

export interface RankingContext {
  snapshot: ThreadSnapshot;

  observations: ObservationQuery;
}

export interface RankedSubject {
  subject: ObservationSubject;

  /**
   * Higher scores are better.
   *
   * The engine is responsible for sorting and assigning ordinal positions if
   * desired.
   */
  score: number;

  metadata?: Record<string, unknown>;
}

export interface RankingResult {
  rankerId: string;
  rankerVersion: string;

  /**
   * Stable identifier for the ranking strategy.
   *
   * Examples:
   *  - golden-path
   *  - chronological
   *  - controversy
   */
  resultType: string;

  items: RankedSubject[];

  metadata?: Record<string, unknown>;

  computedAt: Date;
}

export interface Ranker {
  id: string;
  version: string;

  rank(
    context: RankingContext
  ): Promise<RankingResult>;
}


