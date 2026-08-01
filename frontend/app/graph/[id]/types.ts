// app/graph/[id]/types.ts

import { Post } from "@/app/types";

export interface AnalyzerDescriptor {
  id: string;
  name: string;
  observationTypes: string[];
}

export interface ObservationFilterState {
  subject: ObservationSubjectType;
  types: string[];

  showAuthor: boolean;
  showContent: boolean;
  showEmpty: boolean;
}

export type GraphViewMode =
  | "observations"
  | "ranked";

export interface RankerDescriptor {
  id: string;
  name: string;
}

export type GraphPost = {
  authorId: string;
  id: string;
  body: string;
  createdAt: string;
  parentId: string;
}

export interface GraphNode {
    post: GraphPost;
    observations: Observation[];
    children: GraphNode[];
    depth: number;
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