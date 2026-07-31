// app/graph/[id]/types.ts

export interface AnalyzerDescriptor {
  id: string;
  name: string;
  observationTypes: string[];
}

export interface ObservationFilterState {
  subject: "post" | "edge" | "participant" | "thread";
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