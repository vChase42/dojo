import { Pool } from "pg";

import {
  Embedding,
  EmbeddingFilter,
  EmbeddingRepository,
} from "./types";

import { ObservationSubjectType } from "../../core/types";

export class EmbeddingPostgresRepository implements EmbeddingRepository {
  constructor(private readonly pool: Pool) {}

  async save(embedding: Embedding): Promise<void> {
    await this.saveMany([embedding]);
  }

  async saveMany(embeddings: Embedding[]): Promise<void> {
    if (embeddings.length === 0) {
      return;
    }

    const values: unknown[] = [];
    const rows: string[] = [];

    for (const embedding of embeddings) {
      const offset = values.length;

      values.push(
        embedding.threadId,
        embedding.subjectType,
        embedding.subjectId,
        embedding.modelId,
        embedding.modelVersion,
        this.toVector(embedding.values),
        embedding.createdAt,
      );

      rows.push(
        `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7})`,
      );
    }

    await this.pool.query(
      `
        INSERT INTO conversation_embeddings (
          thread_id,
          subject_type,
          subject_id,
          model_id,
          model_version,
          embedding,
          created_at
        )
        VALUES
        ${rows.join(",")}
      `,
      values,
    );
  }

  async query(filter: EmbeddingFilter): Promise<Embedding[]> {
    const values: unknown[] = [];
    const where = this.buildFilter(filter, values);

    const result = await this.pool.query(
      `
        SELECT *
        FROM conversation_embeddings
        ${where}
      `,
      values,
    );

    return result.rows.map(row => this.mapRow(row));
  }

  async nearest(params: {
    filter: EmbeddingFilter;
    embedding: Float32Array;
    limit: number;
  }): Promise<Embedding[]> {
    const values: unknown[] = [];
    const where = this.buildFilter(params.filter, values);

    values.push(this.toVector(params.embedding));
    const embeddingIndex = values.length;

    values.push(params.limit);
    const limitIndex = values.length;

    const result = await this.pool.query(
      `
        SELECT *
        FROM conversation_embeddings
        ${where}
        ORDER BY embedding <-> $${embeddingIndex}
        LIMIT $${limitIndex}
      `,
      values,
    );

    return result.rows.map(row => this.mapRow(row));
  }

  private buildFilter(filter: EmbeddingFilter, values: unknown[]): string {
    const clauses: string[] = [];

    if (filter.threadIds?.length) {
      values.push(filter.threadIds);
      clauses.push(`thread_id = ANY($${values.length})`);
    }

    if (filter.subjectIds?.length) {
      values.push(filter.subjectIds);
      clauses.push(`subject_id = ANY($${values.length})`);
    }

    if (filter.modelId) {
      values.push(filter.modelId);
      clauses.push(`model_id = $${values.length}`);
    }

    if (filter.modelVersion) {
      values.push(filter.modelVersion);
      clauses.push(`model_version = $${values.length}`);
    }

    return clauses.length === 0 ? "" : `WHERE ${clauses.join(" AND ")}`;
  }

  private mapRow(row: {
    thread_id: string;
    subject_type: ObservationSubjectType;
    subject_id: string;
    model_id: string;
    model_version: string;
    embedding: string;
    created_at: Date;
  }): Embedding {
    return {
      threadId: row.thread_id,
      subjectType: row.subject_type,
      subjectId: row.subject_id,
      modelId: row.model_id,
      modelVersion: row.model_version,
      values: Float32Array.from(
        row.embedding
          .slice(1, -1)
          .split(",")
          .map(Number),
      ),
      createdAt: row.created_at,
    };
  }

  private toVector(values: Float32Array): string {
    return `[${Array.from(values).join(",")}]`;
  }
}