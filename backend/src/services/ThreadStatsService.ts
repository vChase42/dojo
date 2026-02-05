// CREATE TABLE groups (
//   id SERIAL PRIMARY KEY,

//   group_iri TEXT NOT NULL UNIQUE,
//   name TEXT NOT NULL,
//   description TEXT,

//   is_public BOOLEAN NOT NULL DEFAULT TRUE,
//   is_deleted BOOLEAN NOT NULL DEFAULT FALSE,

//   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
// );

import { Pool } from "pg";

export interface ThreadStats {
  groupIri: string;
  rootNoteIri: string;
  title: string;
  creatorIri: string;

  replyCount: number;
  lastActivityAt: string;

  isLocked: boolean;
  isPinned: boolean;
  isDeleted: boolean;

  createdAt: string;
}

export class ThreadStatsService {
  private pg: Pool;

  constructor(pgPool: Pool) {
    this.pg = pgPool;
  }

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
        group_iri,
        root_note_iri,
        title,
        creator_iri,
        reply_count,
        last_activity_at,
        created_at
      )
      VALUES ($1, $2, $3, $4, 0, $5, $5)
      ON CONFLICT (root_note_iri) DO NOTHING
      `,
      [
        groupIri,
        rootNoteIri,
        title,
        creatorIri,
        publishedAt ?? new Date().toISOString(),
      ]
    );
  }

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
      WHERE root_note_iri = $1
      `,
      [
        rootNoteIri,
        activityAt ?? new Date().toISOString(),
      ]
    );
  }

  /**
   * Fetch thread metadata by root note IRI.
   */
  async getByRootNote(
    rootNoteIri: string
  ): Promise<ThreadStats | null> {
    const res = await this.pg.query(
      `
      SELECT
        group_iri,
        root_note_iri,
        title,
        creator_iri,
        reply_count,
        last_activity_at,
        is_locked,
        is_pinned,
        is_deleted,
        created_at
      FROM threads
      WHERE root_note_iri = $1
      `,
      [rootNoteIri]
    );

    if (res.rowCount === 0) return null;

    const row = res.rows[0];
    return {
      groupIri: row.group_iri,
      rootNoteIri: row.root_note_iri,
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
  ): Promise<ThreadStats[]> {
    const res = await this.pg.query(
      `
      SELECT
        group_iri,
        root_note_iri,
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
      rootNoteIri: row.root_note_iri,
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

  /**
   * Moderation helpers
   */
  async lockThread(rootNoteIri: string): Promise<void> {
    await this.pg.query(
      `UPDATE threads SET is_locked = TRUE WHERE root_note_iri = $1`,
      [rootNoteIri]
    );
  }

  async unlockThread(rootNoteIri: string): Promise<void> {
    await this.pg.query(
      `UPDATE threads SET is_locked = FALSE WHERE root_note_iri = $1`,
      [rootNoteIri]
    );
  }

  async pinThread(rootNoteIri: string): Promise<void> {
    await this.pg.query(
      `UPDATE threads SET is_pinned = TRUE WHERE root_note_iri = $1`,
      [rootNoteIri]
    );
  }

  async unpinThread(rootNoteIri: string): Promise<void> {
    await this.pg.query(
      `UPDATE threads SET is_pinned = FALSE WHERE root_note_iri = $1`,
      [rootNoteIri]
    );
  }

  async softDeleteThread(rootNoteIri: string): Promise<void> {
    await this.pg.query(
      `UPDATE threads SET is_deleted = TRUE WHERE root_note_iri = $1`,
      [rootNoteIri]
    );
  }
}


