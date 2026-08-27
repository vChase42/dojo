// src/conversation/persistence/embeddings/EmbeddingSchema.ts

import { Pool } from "pg";

export class EmbeddingSchema {
  constructor(private readonly pg: Pool) {}

  async initialize(): Promise<void> {
    await this.pg.query(`
      CREATE EXTENSION IF NOT EXISTS vector;
    `);

    await this.pg.query(`
      CREATE TABLE IF NOT EXISTS conversation_embeddings (
        thread_id TEXT NOT NULL,

        subject_type TEXT NOT NULL,
        subject_id TEXT NOT NULL,

        model_id TEXT NOT NULL,
        model_version TEXT NOT NULL,

        embedding VECTOR(384) NOT NULL,

        created_at TIMESTAMPTZ NOT NULL,

        PRIMARY KEY (
          subject_id,
          model_id,
          model_version
        )
      );
    `);

    await this.pg.query(`
      CREATE INDEX IF NOT EXISTS idx_conversation_embeddings_thread
      ON conversation_embeddings(thread_id);
    `);

    await this.pg.query(`
      CREATE INDEX IF NOT EXISTS idx_conversation_embeddings_subject
      ON conversation_embeddings(
        thread_id,
        subject_type,
        subject_id
      );
    `);

    await this.pg.query(`
      CREATE INDEX IF NOT EXISTS idx_conversation_embeddings_model
      ON conversation_embeddings(
        model_id,
        model_version
      );
    `);

    await this.pg.query(`
      CREATE INDEX IF NOT EXISTS idx_conversation_embeddings_vector
      ON conversation_embeddings
      USING hnsw (embedding vector_cosine_ops);
    `);
  }
}