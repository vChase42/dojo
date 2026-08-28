// src/conversation/persistence/observationRepository.ts

import { Pool } from "pg";
import {
  Observation,
  ObservationRepository as ObservationRepositoryI,
  ObservationSubjectType,
} from "../core/types";

export class ObservationRepository implements ObservationRepositoryI {
  constructor(private readonly pg: Pool) {}

  async saveAll(params: {
    threadId: string;
    observations: Observation[];
  }): Promise<void> {
    const chunkSize = 2000;

    for (let i = 0; i < params.observations.length; i += chunkSize) {
      await this.saveChunk({
        threadId: params.threadId,
        observations: params.observations.slice(i, i + chunkSize),
      });
    }
  }

  private async saveChunk(params: {
    threadId: string;
    observations: Observation[];
  }): Promise<void> {
    if (params.observations.length === 0) {
      return;
    }

    const values: unknown[] = [];
    const rows: string[] = [];

    for (const observation of params.observations) {
      const offset = values.length;

      values.push(
        params.threadId,
        observation.subject.type,
        observation.subject.id,
        observation.type,
        observation.analyzerId,
        observation.analyzerVersion,
        JSON.stringify(observation.data),
        observation.computedAt,
      );

      rows.push(
        `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8})`,
      );
    }

    await this.pg.query(
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
      VALUES
      ${rows.join(",")}
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
      values,
    );
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
      values,
    );
  }
}