// src/services/threadService.ts

import { Pool } from "pg";
import { Thread } from "../types";

export class ThreadService {
  constructor(private pg: Pool) {
    this.initialize();
  }

  // ------------------------------------------------
  // Initialization
  // ------------------------------------------------

  async initialize(): Promise<void> {
    await this.pg.query(`
      CREATE TABLE IF NOT EXISTS threads (
        id TEXT PRIMARY KEY,

        group_iri TEXT NOT NULL,
        title TEXT NOT NULL,
        creator_iri TEXT NOT NULL,

        reply_count INTEGER NOT NULL DEFAULT 0,
        last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        is_locked BOOLEAN NOT NULL DEFAULT FALSE,
        is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
        is_deleted BOOLEAN NOT NULL DEFAULT FALSE,

        moderation_status TEXT NOT NULL DEFAULT 'visible',
        deleted_reason TEXT NULL,
        deleted_by TEXT NULL,
        deleted_at TIMESTAMPTZ NULL,

        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await this.pg.query(`
      ALTER TABLE threads
      ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'visible';
    `);

    await this.pg.query(`
      ALTER TABLE threads
      ADD COLUMN IF NOT EXISTS deleted_reason TEXT NULL;
    `);

    await this.pg.query(`
      ALTER TABLE threads
      ADD COLUMN IF NOT EXISTS deleted_by TEXT NULL;
    `);

    await this.pg.query(`
      ALTER TABLE threads
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;
    `);

    await this.pg.query(`
      ALTER TABLE threads
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    `);

    await this.pg.query(`
      CREATE INDEX IF NOT EXISTS idx_threads_group
      ON threads(group_iri);
    `);

    await this.pg.query(`
      CREATE INDEX IF NOT EXISTS idx_threads_group_activity
      ON threads(group_iri, is_deleted, is_pinned, last_activity_at DESC);
    `);
  }

  // ------------------------------------------------
  // Creation
  // ------------------------------------------------

  async createThread(params: {
    groupIri: string;
    rootNoteIri: string;
    title: string;
    creatorIri: string;
    publishedAt?: string;
  }): Promise<void> {
    const publishedAt = params.publishedAt ?? new Date().toISOString();

    await this.pg.query(
      `
      INSERT INTO threads (
        id,
        group_iri,
        title,
        creator_iri,
        reply_count,
        last_activity_at,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, 0, $5, $5, $5)
      ON CONFLICT (id) DO NOTHING
      `,
      [
        params.rootNoteIri,
        params.groupIri,
        params.title,
        params.creatorIri,
        publishedAt,
      ]
    );
  }

  // ------------------------------------------------
  // Aggregates
  // ------------------------------------------------

  async incrementReplies(
    rootNoteIri: string,
    activityAt?: string
  ): Promise<void> {
    await this.pg.query(
      `
      UPDATE threads
      SET
        reply_count = reply_count + 1,
        last_activity_at = $2,
        updated_at = NOW()
      WHERE id = $1
      `,
      [
        rootNoteIri,
        activityAt ?? new Date().toISOString(),
      ]
    );
  }

  // ------------------------------------------------
  // Reads
  // ------------------------------------------------

  async getByRootNote(rootNoteIri: string): Promise<Thread | null> {
    const res = await this.pg.query(
      `
      SELECT *
      FROM threads
      WHERE id = $1
      `,
      [rootNoteIri]
    );

    if (res.rowCount === 0) return null;

    return this.mapThread(res.rows[0]);
  }

  async listByGroup(params: {
    groupIri: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    items: Thread[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const limit = Math.min(params.limit ?? 50, 100);
    const offset = Math.max(params.offset ?? 0, 0);

    const totalRes = await this.pg.query(
      `
      SELECT COUNT(*)::int AS total
      FROM threads
      WHERE group_iri = $1
        AND is_deleted = FALSE
      `,
      [params.groupIri]
    );

    const res = await this.pg.query(
      `
      SELECT *
      FROM threads
      WHERE group_iri = $1
        AND is_deleted = FALSE
      ORDER BY
        is_pinned DESC,
        last_activity_at DESC
      LIMIT $2
      OFFSET $3
      `,
      [params.groupIri, limit, offset]
    );

    return {
      items: res.rows.map(this.mapThread),
      total: totalRes.rows[0].total,
      limit,
      offset,
    };
  }

  // ------------------------------------------------
  // Moderation
  // ------------------------------------------------

  async lockThread(rootNoteIri: string): Promise<void> {
    await this.pg.query(
      `
      UPDATE threads
      SET
        is_locked = TRUE,
        updated_at = NOW()
      WHERE id = $1
      `,
      [rootNoteIri]
    );
  }

  async unlockThread(rootNoteIri: string): Promise<void> {
    await this.pg.query(
      `
      UPDATE threads
      SET
        is_locked = FALSE,
        updated_at = NOW()
      WHERE id = $1
      `,
      [rootNoteIri]
    );
  }

  async pinThread(rootNoteIri: string): Promise<void> {
    await this.pg.query(
      `
      UPDATE threads
      SET
        is_pinned = TRUE,
        updated_at = NOW()
      WHERE id = $1
      `,
      [rootNoteIri]
    );
  }

  async unpinThread(rootNoteIri: string): Promise<void> {
    await this.pg.query(
      `
      UPDATE threads
      SET
        is_pinned = FALSE,
        updated_at = NOW()
      WHERE id = $1
      `,
      [rootNoteIri]
    );
  }

  async softDeleteThread(params: {
    rootNoteIri: string;
    deletedBy: string;
    reason?: string;
  }): Promise<void> {
    await this.pg.query(
      `
      UPDATE threads
      SET
        is_deleted = TRUE,
        moderation_status = 'deleted',
        deleted_reason = $2,
        deleted_by = $3,
        deleted_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
      `,
      [
        params.rootNoteIri,
        params.reason ?? null,
        params.deletedBy,
      ]
    );
  }

  async restoreThread(rootNoteIri: string): Promise<void> {
    await this.pg.query(
      `
      UPDATE threads
      SET
        is_deleted = FALSE,
        moderation_status = 'visible',
        deleted_reason = NULL,
        deleted_by = NULL,
        deleted_at = NULL,
        updated_at = NOW()
      WHERE id = $1
      `,
      [rootNoteIri]
    );
  }

  // ------------------------------------------------
  // Internal helpers
  // ------------------------------------------------

  private mapThread = (row: any): Thread => ({
    id: row.id,

    groupIri: row.group_iri,
    title: row.title,
    creatorIri: row.creator_iri,

    replyCount: row.reply_count,
    lastActivityAt: row.last_activity_at,

    isLocked: row.is_locked,
    isPinned: row.is_pinned,
    isDeleted: row.is_deleted,

    moderationStatus: row.moderation_status ?? "visible",
    deletedReason: row.deleted_reason ?? null,
    deletedBy: row.deleted_by ?? null,
    deletedAt: row.deleted_at ?? null,

    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}