// src/conversation/persistence/observationSchema.ts

import { Pool } from "pg";

export class ObservationSchema {
  constructor(private readonly pg: Pool) {}

  async initialize(): Promise<void> {
    await this.pg.query(`
      CREATE TABLE IF NOT EXISTS conversation_observations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

        thread_id TEXT NOT NULL,

        subject_type TEXT NOT NULL,
        subject_id TEXT NOT NULL,

        type TEXT NOT NULL,

        analyzer_id TEXT NOT NULL,
        analyzer_version TEXT NOT NULL,

        data JSONB NOT NULL,

        computed_at TIMESTAMPTZ NOT NULL,

        UNIQUE (
          thread_id,
          subject_type,
          subject_id,
          type,
          analyzer_id,
          analyzer_version
        )
      );
    `);

    await this.pg.query(`
      CREATE INDEX IF NOT EXISTS idx_conversation_observations_thread
      ON conversation_observations(thread_id);
    `);

    await this.pg.query(`
      CREATE INDEX IF NOT EXISTS idx_conversation_observations_subject
      ON conversation_observations(
        thread_id,
        subject_type,
        subject_id
      );
    `);

    await this.pg.query(`
      CREATE INDEX IF NOT EXISTS idx_conversation_observations_type
      ON conversation_observations(
        thread_id,
        type
      );
    `);

    await this.pg.query(`
      CREATE INDEX IF NOT EXISTS idx_conversation_observations_analyzer
      ON conversation_observations(
        thread_id,
        analyzer_id,
        analyzer_version
      );
    `);

    await this.pg.query(`
      CREATE INDEX IF NOT EXISTS idx_conversation_observations_lookup
      ON conversation_observations(
        thread_id,
        type,
        subject_type,
        subject_id
      );
    `);

    await this.pg.query(`
      CREATE INDEX IF NOT EXISTS idx_conversation_observations_computed
      ON conversation_observations(
        thread_id,
        computed_at
      );
    `);
  }
}
