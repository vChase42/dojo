// src/conversation/core/types.ts

import { Post, Thread } from "../../types";

export interface ConversationEdge {
  id: string;
  parentId: string;
  childId: string;
}

export interface ThreadSnapshot {
  thread: Thread;
  posts: Post[];
  rootPost: Post;

  postsById: Map<string, Post>;
  childrenByParentId: Map<string, Post[]>;
  edges: ConversationEdge[];

  participants: string[];

  capturedAt: Date;
}

export type ObservationSubjectType =
  | "thread"
  | "post"
  | "edge"
  | "participant"
  | "branch";

export interface ObservationSubject {
  type: ObservationSubjectType;
  id: string;
}

export interface Observation<
  TData extends Record<string, unknown> = Record<string, unknown>
> {
  subject: ObservationSubject;

  // Stable identifier for the kind of derived information.
  kind: string;

  analyzerId: string;
  analyzerVersion: string;

  data: TData;

  computedAt: Date;
}

export interface AnalysisContext {
  snapshot: ThreadSnapshot;

  // Allows analyzers to consume results produced earlier in the run.
  observations: Observation[];
}

export interface Analyzer {
  id: string;
  version: string;

  analyze(context: AnalysisContext): Promise<Observation[]>;
}

export interface RankingContext {
  snapshot: ThreadSnapshot;
  observations: Observation[];
}

export interface RankedItem {
  subject: ObservationSubject;

  rank?: number;
  score?: number;

  metadata?: Record<string, unknown>;
}

export interface RankingResult {
  rankerId: string;
  rankerVersion: string;

  threadId: string;
  resultType: string;

  items: RankedItem[];

  metadata?: Record<string, unknown>;

  computedAt: Date;
}

export interface Ranker {
  id: string;
  version: string;

  rank(context: RankingContext): Promise<RankingResult>;
}