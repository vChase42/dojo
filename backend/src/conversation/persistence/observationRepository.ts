// src/conversation/persistence/observationRepository.ts

import { Pool } from "pg";
import { Observation, ObservationRepository as ObservationRepositoryI, ObservationSubjectType } from "../core/types";

export class ObservationRepository implements ObservationRepositoryI{
  constructor(private readonly pg: Pool) {}

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

            type,

            analyzer_id,
            analyzer_version,

            data,

            computed_at
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8
          )
          ON CONFLICT (
            thread_id,
            subject_type,
            subject_id,
            type,
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

            observation.type,

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

async delete(params: {
  threadId: string;

  subjectType?: ObservationSubjectType;
  subjectId?: string;

  type?: string;

  analyzerId?: string;
  analyzerIds?: string[];
  analyzerVersion?: string;
}): Promise<void> {
  const values: unknown[] = [];
  const where: string[] = [];

  values.push(params.threadId);
  where.push(`thread_id = $${values.length}`);

  if (params.subjectType) {
    values.push(params.subjectType);
    where.push(`subject_type = $${values.length}`);
  }

  if (params.subjectId) {
    values.push(params.subjectId);
    where.push(`subject_id = $${values.length}`);
  }

  if (params.type) {
    values.push(params.type);
    where.push(`type = $${values.length}`);
  }

  if (params.analyzerId) {
    values.push(params.analyzerId);
    where.push(`analyzer_id = $${values.length}`);
  }

  if (params.analyzerIds?.length) {
    values.push(params.analyzerIds);
    where.push(`analyzer_id = ANY($${values.length})`);
  }

  if (params.analyzerVersion) {
    values.push(params.analyzerVersion);
    where.push(`analyzer_version = $${values.length}`);
  }

  await this.pg.query(
    `
    DELETE
    FROM conversation_observations
    WHERE ${where.join(" AND ")}
    `,
    values
  );
}
}