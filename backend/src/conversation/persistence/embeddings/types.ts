// src/conversation/persistence/embeddings/types.ts

import { ObservationSubjectType } from "../../core/types";

export interface EmbeddingModel {
  readonly id: string;
  readonly version: string;
  readonly dimensions: number;

  embed(text: string): Promise<Float32Array>;

  embedMany(texts: readonly string[]): Promise<Float32Array[]>;

}

export interface Embedding {
  subjectType: ObservationSubjectType;
  subjectId: string;

  modelId: string;
  modelVersion: string;

  values: Float32Array;

  createdAt: Date;
}


export interface EmbeddingReference {
  id: string;
}

export interface EmbeddingRecord {
  id: string;
  values: Float32Array;
}

export interface ClusterAssignment {
  id: string;
  cluster: number;
}