// app/graph/[id]/types.ts

import { Post } from "@/app/types";

export interface AnalyzerDescriptor {
  id: string;
  name: string;
  observationTypes: string[];
}


export type GraphViewMode =
| "observations"
| "ranked";

export interface RankerDescriptor {
  id: string;
  name: string;
}



export interface ObservationFilterState {
  types: string[];

  includeThread: boolean;
  includePosts: boolean;
  includeEdges: boolean;
  includeParticipants: boolean;
  includeBranches: boolean;

  showAuthor: boolean;
  showContent: boolean;
  showEmpty: boolean;
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
  TPayload extends Record<string, unknown> = Record<string, unknown>
> {
  subject: ObservationSubject;

  type: string;

  analyzerId: string;
  analyzerVersion: string;

  data: TPayload;

  computedAt: string;
}

export interface ObservationGroup {
  type: string;
  observations: Observation[];
}

export interface GraphPost {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
  parentId: string;
}

export interface GraphSubject {
  key: string;
  type: ObservationSubjectType;
  id: string;
  observations: Observation[];
  payload?: unknown;
}

export interface ObservationTreeNode {
  subject: GraphSubject;
  children: ObservationTreeNode[];
}

export interface ObservationGraph {
  root: ObservationTreeNode;
  posts: Map<string, GraphPost>;
}