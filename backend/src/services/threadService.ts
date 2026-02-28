// src/services/threadService.ts

import { Pool } from "pg";
import { Thread } from "../types";

export class ThreadService {
  private pg: Pool;

  constructor(pgPool: Pool) {
    this.pg = pgPool;
  }

  // ------------------------------------------------
  // Initialization
  // ------------------------------------------------

  /**
   * Ensure threads table + indexes exist.
   * Safe to call on startup.
   */
  async initialize(): Promise<void> {
    await this.pg.query(`
      CREATE TABLE IF NOT EXISTS threads (
        id TEXT PRIMARY KEY,                -- root note IRI

        group_iri TEXT NOT NULL,
        title TEXT NOT NULL,
        creator_iri TEXT NOT NULL,

        reply_count INTEGER NOT NULL DEFAULT 0,
        last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        is_locked BOOLEAN NOT NULL DEFAULT FALSE,
        is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
        is_deleted BOOLEAN NOT NULL DEFAULT FALSE,

        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
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

  /**
   * Create a new thread entry.
   * Called exactly once for a root note.
   */
  async createThread(params: {
    groupIri: string;
    rootNoteIri: string;
    title: string;
    creatorIri: string;
    publishedAt?: string;
  }): Promise<void> {
    const {
      groupIri,
      rootNoteIri,
      title,
      creatorIri,
      publishedAt,
    } = params;

    await this.pg.query(
      `
      INSERT INTO threads (
        id,
        group_iri,
        title,
        creator_iri,
        reply_count,
        last_activity_at,
        created_at
      )
      VALUES ($1, $2, $3, $4, 0, $5, $5)
      ON CONFLICT (id) DO NOTHING
      `,
      [
        rootNoteIri,
        groupIri,
        title,
        creatorIri,
        publishedAt ?? new Date().toISOString(),
      ]
    );
  }

  // ------------------------------------------------
  // Aggregates
  // ------------------------------------------------

  /**
   * Increment reply count and bump activity time.
   * Called when a reply is accepted.
   */
  async incrementReplies(
    rootNoteIri: string,
    activityAt?: string
  ): Promise<void> {
    await this.pg.query(
      `
      UPDATE threads
      SET
        reply_count = reply_count + 1,
        last_activity_at = $2
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

  /**
   * Fetch thread metadata by root note IRI.
   */
  async getByRootNote(
    rootNoteIri: string
  ): Promise<Thread | null> {
    const res = await this.pg.query(
      `
      SELECT
        group_iri,
        id,
        title,
        creator_iri,
        reply_count,
        last_activity_at,
        is_locked,
        is_pinned,
        is_deleted,
        created_at
      FROM threads
      WHERE id = $1
      `,
      [rootNoteIri]
    );

    if (res.rowCount === 0) return null;

    const row = res.rows[0];

    return {
      groupIri: row.group_iri,
      id: row.id,
      title: row.title,
      creatorIri: row.creator_iri,

      replyCount: row.reply_count,
      lastActivityAt: row.last_activity_at,

      isLocked: row.is_locked,
      isPinned: row.is_pinned,
      isDeleted: row.is_deleted,

      createdAt: row.created_at,
    };
  }

  /**
   * List threads for a group.
   * Used for forum index pages.
   */
  async listByGroup(
    groupIri: string,
    limit = 50,
    offset = 0
  ): Promise<Thread[]> {
    const res = await this.pg.query(
      `
      SELECT
        group_iri,
        id,
        title,
        creator_iri,
        reply_count,
        last_activity_at,
        is_locked,
        is_pinned,
        is_deleted,
        created_at
      FROM threads
      WHERE group_iri = $1
        AND is_deleted = FALSE
      ORDER BY
        is_pinned DESC,
        last_activity_at DESC
      LIMIT $2 OFFSET $3
      `,
      [groupIri, limit, offset]
    );

    return res.rows.map((row) => ({
      groupIri: row.group_iri,
      id: row.id,
      title: row.title,
      creatorIri: row.creator_iri,

      replyCount: row.reply_count,
      lastActivityAt: row.last_activity_at,

      isLocked: row.is_locked,
      isPinned: row.is_pinned,
      isDeleted: row.is_deleted,

      createdAt: row.created_at,
    }));
  }

  // ------------------------------------------------
  // Moderation
  // ------------------------------------------------

  async lockThread(rootNoteIri: string): Promise<void> {
    await this.pg.query(
      `UPDATE threads SET is_locked = TRUE WHERE id = $1`,
      [rootNoteIri]
    );
  }

  async unlockThread(rootNoteIri: string): Promise<void> {
    await this.pg.query(
      `UPDATE threads SET is_locked = FALSE WHERE id = $1`,
      [rootNoteIri]
    );
  }

  async pinThread(rootNoteIri: string): Promise<void> {
    await this.pg.query(
      `UPDATE threads SET is_pinned = TRUE WHERE id = $1`,
      [rootNoteIri]
    );
  }

  async unpinThread(rootNoteIri: string): Promise<void> {
    await this.pg.query(
      `UPDATE threads SET is_pinned = FALSE WHERE id = $1`,
      [rootNoteIri]
    );
  }

  async softDeleteThread(rootNoteIri: string): Promise<void> {
    await this.pg.query(
      `UPDATE threads SET is_deleted = TRUE WHERE id = $1`,
      [rootNoteIri]
    );
  }
}