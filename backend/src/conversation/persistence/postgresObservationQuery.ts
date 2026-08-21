// src/conversation/persistence/postgresObservationQuery.ts

import { Pool } from "pg";
import {
  Observation,
  ObservationFilter,
  ObservationQuery,
} from "../core/types";

export class PostgresObservationQuery
  implements ObservationQuery
{
  constructor(
    private readonly pg: Pool,
    private readonly threadId: string
  ) {}
  async list(
    filter: ObservationFilter = {}
  ): Promise<Observation[]> {
    const { sql, values } = this.buildQuery(filter);

    const result = await this.pg.query(
      `
      ${sql}
      ORDER BY computed_at ASC
      `,
      values
    );

    return result.rows.map(this.mapObservation);
  }

  async first(
    filter: ObservationFilter
  ): Promise<Observation | null> {
    const { sql, values } = this.buildQuery(filter);

    const result = await this.pg.query(
      `
      ${sql}
      ORDER BY computed_at DESC
      LIMIT 1
      `,
      values
    );

    if (result.rowCount === 0) {
      return null;
    }

    return this.mapObservation(result.rows[0]);
  }

  async exists(
    filter: ObservationFilter
  ): Promise<boolean> {
    const { sql, values } = this.buildQuery(filter);

    const result = await this.pg.query(
      `
      SELECT EXISTS (
        ${sql}
      ) AS exists
      `,
      values
    );

    return result.rows[0].exists;
  }

  // ---------------------------------------------------------------------------

private buildQuery(
  filter: ObservationFilter
): {
  sql: string;
  values: unknown[];
} {
  const values: unknown[] = [this.threadId];
  const where: string[] = ["thread_id = $1"];

  if (filter.subjectType) {
    values.push(filter.subjectType);
    where.push(`subject_type = $${values.length}`);
  }

  if (filter.subjectId) {
    values.push(filter.subjectId);
    where.push(`subject_id = $${values.length}`);
  }

  if (filter.type) {
    values.push(filter.type);
    where.push(`type = $${values.length}`);
  }

  if (filter.analyzerId) {
    values.push(filter.analyzerId);
    where.push(`analyzer_id = $${values.length}`);
  }

  if (filter.analyzerIds?.length) {
    values.push(filter.analyzerIds);
    where.push(`analyzer_id = ANY($${values.length})`);
  }

  if (filter.analyzerVersion) {
    values.push(filter.analyzerVersion);
    where.push(`analyzer_version = $${values.length}`);
  }

  return {
    sql: `
      SELECT *
      FROM conversation_observations
      ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""}
    `,
    values,
  };
}

  private mapObservation(
    row: any
  ): Observation {
    return {
      subject: {
        type: row.subject_type,
        id: row.subject_id,
      },

      type: row.type,

      analyzerId: row.analyzer_id,
      analyzerVersion: row.analyzer_version,

      data: row.data,

      computedAt: row.computed_at,
    };
  }
}