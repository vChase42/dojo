import { Pool } from "pg";


// CREATE TABLE note_stats (
//   note_id TEXT PRIMARY KEY,
//   replies INTEGER NOT NULL DEFAULT 0,
//   ups INTEGER NOT NULL DEFAULT 0,
//   downs INTEGER NOT NULL DEFAULT 0
// );


export interface NoteStats {
  noteId: string;
  replies: number;
  ups: number;
  downs: number;
}

export class NoteStatsService {
  private pg: Pool;

  constructor(pgPool: Pool) {
    this.pg = pgPool;
  }

  /**
   * Ensure a stats row exists for a note.
   * Safe to call multiple times.
   */
  async ensure(noteId: string): Promise<void> {
    await this.pg.query(
      `
      INSERT INTO note_stats (note_id, replies, ups, downs)
      VALUES ($1, 0, 0, 0)
      ON CONFLICT (note_id) DO NOTHING
      `,
      [noteId]
    );
  }

  /**
   * Increment reply count for a note.
   * Used when a reply is successfully created.
   */
  async incrementReplies(noteId: string): Promise<void> {
    await this.pg.query(
      `
      UPDATE note_stats
      SET replies = replies + 1
      WHERE note_id = $1
      `,
      [noteId]
    );
  }

  /**
   * Increment upvote count.
   */
  async incrementUps(noteId: string): Promise<void> {
    await this.pg.query(
      `
      UPDATE note_stats
      SET ups = ups + 1
      WHERE note_id = $1
      `,
      [noteId]
    );
  }

  /**
   * Increment downvote count.
   */
  async incrementDowns(noteId: string): Promise<void> {
    await this.pg.query(
      `
      UPDATE note_stats
      SET downs = downs + 1
      WHERE note_id = $1
      `,
      [noteId]
    );
  }

  /**
   * Fetch stats for a note.
   * Returns null if not initialized.
   */
  async get(noteId: string): Promise<NoteStats | null> {
    const res = await this.pg.query(
      `
      SELECT note_id, replies, ups, downs
      FROM note_stats
      WHERE note_id = $1
      `,
      [noteId]
    );

    if (res.rowCount === 0) {
      return null;
    }

    const row = res.rows[0];
    return {
      noteId: row.note_id,
      replies: row.replies,
      ups: row.ups,
      downs: row.downs,
    };
  }

  /**
   * Set initial counts (used for Reddit ingestion).
   * Overwrites existing values.
   */
  async setInitial(
    noteId: string,
    {
      replies = 0,
      ups = 0,
      downs = 0,
    }: Partial<Omit<NoteStats, "noteId">>
  ): Promise<void> {
    await this.pg.query(
      `
      INSERT INTO note_stats (note_id, replies, ups, downs)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (note_id)
      DO UPDATE SET
        replies = EXCLUDED.replies,
        ups = EXCLUDED.ups,
        downs = EXCLUDED.downs
      `,
      [noteId, replies, ups, downs]
    );
  }

  /**
   * Delete stats (admin / cleanup / reindex).
   */
  async delete(noteId: string): Promise<void> {
    await this.pg.query(
      `DELETE FROM note_stats WHERE note_id = $1`,
      [noteId]
    );
  }
}
