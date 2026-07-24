// src/conversation/persistence/observationRepository.ts

import { Pool } from "pg";
import { Observation } from "../core/types";

export class ObservationRepository {
  constructor(private pg: Pool) {}

  async initialize(): Promise<void> {
    await this.pg.query(`
      CREATE TABLE IF NOT EXISTS conversation_observations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

        thread_id TEXT NOT NULL,

        subject_type TEXT NOT NULL,
        subject_id TEXT NOT NULL,

        kind TEXT NOT NULL,

        analyzer_id TEXT NOT NULL,
        analyzer_version TEXT NOT NULL,

        data JSONB NOT NULL,

        computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        UNIQUE (
          thread_id,
          subject_type,
          subject_id,
          kind,
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
        subject_type,
        subject_id
      );
    `);

    await this.pg.query(`
      CREATE INDEX IF NOT EXISTS idx_conversation_observations_kind
      ON conversation_observations(kind);
    `);

    await this.pg.query(`
      CREATE INDEX IF NOT EXISTS idx_conversation_observations_analyzer
      ON conversation_observations(
        analyzer_id,
        analyzer_version
      );
    `);
  }

  async saveAll(params: {
    threadId: string;
    observations: Observation[];
  }): Promise<void> {
    if (params.observations.length === 0) {
      return;
    }

    const client = await this.pg.connect();

    try {
      await client.query("BEGIN");

      for (const observation of params.observations) {
        await client.query(
          `
          INSERT INTO conversation_observations (
            thread_id,
            subject_type,
            subject_id,
            kind,
            analyzer_id,
            analyzer_version,
            data,
            computed_at
          )
          VALUES (
            $1, $2, $3, $4,
            $5, $6, $7, $8
          )
          ON CONFLICT (
            thread_id,
            subject_type,
            subject_id,
            kind,
            analyzer_id,
            analyzer_version
          )
          DO UPDATE SET
            data = EXCLUDED.data,
            computed_at = EXCLUDED.computed_at
          `,
          [
            params.threadId,

            observation.subject.type,
            observation.subject.id,

            observation.kind,

            observation.analyzerId,
            observation.analyzerVersion,

            JSON.stringify(observation.data),

            observation.computedAt,
          ]
        );
      }

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async getForThread(
    threadId: string
  ): Promise<Observation[]> {
    const res = await this.pg.query(
      `
      SELECT *
      FROM conversation_observations
      WHERE thread_id = $1
      ORDER BY computed_at ASC
      `,
      [threadId]
    );

    return res.rows.map(this.mapObservation);
  }

  async getForSubject(params: {
    threadId: string;
    subjectType: string;
    subjectId: string;
  }): Promise<Observation[]> {
    const res = await this.pg.query(
      `
      SELECT *
      FROM conversation_observations
      WHERE thread_id = $1
        AND subject_type = $2
        AND subject_id = $3
      ORDER BY computed_at ASC
      `,
      [
        params.threadId,
        params.subjectType,
        params.subjectId,
      ]
    );

    return res.rows.map(this.mapObservation);
  }

  async getByKind(params: {
    threadId: string;
    kind: string;
  }): Promise<Observation[]> {
    const res = await this.pg.query(
      `
      SELECT *
      FROM conversation_observations
      WHERE thread_id = $1
        AND kind = $2
      ORDER BY computed_at ASC
      `,
      [
        params.threadId,
        params.kind,
      ]
    );

    return res.rows.map(this.mapObservation);
  }

  async getByAnalyzer(params: {
    threadId: string;
    analyzerId: string;
    analyzerVersion?: string;
  }): Promise<Observation[]> {
    const values: unknown[] = [
      params.threadId,
      params.analyzerId,
    ];

    let versionClause = "";

    if (params.analyzerVersion) {
      values.push(params.analyzerVersion);
      versionClause = `
        AND analyzer_version = $3
      `;
    }

    const res = await this.pg.query(
      `
      SELECT *
      FROM conversation_observations
      WHERE thread_id = $1
        AND analyzer_id = $2
        ${versionClause}
      ORDER BY computed_at ASC
      `,
      values
    );

    return res.rows.map(this.mapObservation);
  }

  async deleteByAnalyzer(params: {
    threadId: string;
    analyzerId: string;
    analyzerVersion?: string;
  }): Promise<void> {
    if (params.analyzerVersion) {
      await this.pg.query(
        `
        DELETE FROM conversation_observations
        WHERE thread_id = $1
          AND analyzer_id = $2
          AND analyzer_version = $3
        `,
        [
          params.threadId,
          params.analyzerId,
          params.analyzerVersion,
        ]
      );

      return;
    }

    await this.pg.query(
      `
      DELETE FROM conversation_observations
      WHERE thread_id = $1
        AND analyzer_id = $2
      `,
      [
        params.threadId,
        params.analyzerId,
      ]
    );
  }

  private mapObservation = (
    row: any
  ): Observation => ({
    subject: {
      type: row.subject_type,
      id: row.subject_id,
    },

    kind: row.kind,

    analyzerId: row.analyzer_id,
    analyzerVersion: row.analyzer_version,

    data: row.data,

    computedAt: row.computed_at,
  });
}