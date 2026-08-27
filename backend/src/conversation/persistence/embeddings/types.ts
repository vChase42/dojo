// src/conversation/persistence/embeddings/types.ts

import { ObservationSubject, ObservationSubjectType } from "../../core/types";

export interface EmbeddingFilter {
  threadIds?: string[];
  subjectIds?: string[];

  modelId?: string;
  modelVersion?: string;
}

export interface EmbeddingRepository {
  save(embedding: Embedding): Promise<void>;

  saveMany(embeddings: Embedding[]): Promise<void>;

  query(filter: EmbeddingFilter): Promise<Embedding[]>;

  nearest(params: {
    filter: EmbeddingFilter;
    embedding: Float32Array;
    limit: number;
  }): Promise<Embedding[]>;
}

export interface EmbeddingModel {
  readonly id: string;
  readonly version: string;
  readonly dimensions: number;

  embed(text: string): Promise<Float32Array>;

  embedMany(texts: readonly string[]): Promise<Float32Array[]>;

}

export interface Embedding {
  threadId: string;

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


export interface EmbeddableSubject {
  subject: ObservationSubject;
  postIds: string[];
}