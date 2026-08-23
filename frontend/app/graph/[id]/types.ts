// app/graph/[id]/types.ts

import { Post } from "@/app/types";

export interface AnalyzerDescriptor {
  id: string;
  name: string;
  version: string; //stub
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
  enabledTypes: Set<string>;

  includeThread: boolean;
  includePosts: boolean;
  includeEdges: boolean;
  includeParticipants: boolean;
  includeBranches: boolean;
  includePaths: boolean;

  showAuthor: boolean;
  showContent: boolean;
  showEmpty: boolean;
}

export type ObservationSubjectType =
  | "thread"
  | "post"
  | "edge"
  | "participant"
  | "branch"
  | "session"
  | "path";

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
  namespace: string;
  observations: Observation[];
}

export interface GraphPost {
  id: string;
  authorIri: string;
  content: string;
  createdAt: string;
  parentId: string;
}

export interface GraphSubject {
  key: string;
  type: ObservationSubjectType;
  id: string;
  observations: Observation[];
  renderPayload?: unknown;
}

export interface ObservationTreeNode {
  subject: GraphSubject;
  children: ObservationTreeNode[];
}

export interface ObservationGraph {
  root: ObservationTreeNode;
  posts: Map<string, GraphPost>;
}