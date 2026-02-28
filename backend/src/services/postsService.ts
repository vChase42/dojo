// src/services/postsService.ts

import { Pool } from "pg";
import { Post, PostRevision } from "../types";

export class PostsService {
  constructor(private pg: Pool) {this.initialize();}

  // ------------------------------------------------
  // Initialization
  // ------------------------------------------------

  async initialize(): Promise<void> {
    await this.pg.query(`
      CREATE TABLE IF NOT EXISTS posts (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL,
        author_iri TEXT NOT NULL,
        parent_id TEXT NULL,
        content TEXT NOT NULL,

        upvotes INT NOT NULL DEFAULT 0,
        downvotes INT NOT NULL DEFAULT 0,
        reply_count INT NOT NULL DEFAULT 0,
        revision_count INT NOT NULL DEFAULT 1,

        is_deleted BOOLEAN NOT NULL DEFAULT FALSE,

        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await this.pg.query(`
      CREATE TABLE IF NOT EXISTS post_revisions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        post_id TEXT NOT NULL,
        revision_number INT NOT NULL,
        editor_iri TEXT NOT NULL,
        content TEXT NOT NULL,
        edit_reason TEXT,
        edited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        UNIQUE(post_id, revision_number)
      );
    `);

    await this.pg.query(`
      CREATE TABLE IF NOT EXISTS post_votes (
        post_id TEXT NOT NULL,
        user_iri TEXT NOT NULL,
        value SMALLINT NOT NULL CHECK (value IN (-1, 1)),

        PRIMARY KEY (post_id, user_iri)
      );
    `);

    await this.pg.query(`
      CREATE INDEX IF NOT EXISTS idx_posts_thread
      ON posts(thread_id);
    `);

    await this.pg.query(`
      CREATE INDEX IF NOT EXISTS idx_posts_parent
      ON posts(parent_id);
    `);

    await this.pg.query(`
      CREATE INDEX IF NOT EXISTS idx_revisions_post
      ON post_revisions(post_id);
    `);
  }

  // ------------------------------------------------
  // Creation
  // ------------------------------------------------

  async createPost(params: {
    id: string;               // noteIri
    authorIri: string;
    content: string;
    parentId?: string | null;
    publishedAt?: Date;
  }): Promise<Post> {
    const client = await this.pg.connect();

    try {
      await client.query("BEGIN");

      let threadId = params.id; // default: self = root

      if (params.parentId) {
        const res = await client.query(
          `SELECT thread_id FROM posts WHERE id = $1`,
          [params.parentId]
        );

        if (res.rowCount === 0) {
          throw new Error("Parent post not found");
        }

        threadId = res.rows[0].thread_id;

        // increment direct child count of parent
        await client.query(
          `UPDATE posts
          SET reply_count = reply_count + 1
          WHERE id = $1`,
          [params.parentId]
        );
      }

      // insert post
      await client.query(
        `
        INSERT INTO posts (
          id,
          thread_id,
          author_iri,
          parent_id,
          content,
          created_at,
          updated_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$6)
        `,
        [
          params.id,
          threadId,
          params.authorIri,
          params.parentId ?? null,
          params.content,
          params.publishedAt ?? new Date(),
        ]
      );

      // initial revision
      await client.query(
        `
        INSERT INTO post_revisions (
          post_id,
          revision_number,
          editor_iri,
          content
        )
        VALUES ($1,1,$2,$3)
        `,
        [params.id, params.authorIri, params.content]
      );

      await client.query("COMMIT");

      return this.getPostOrThrow(params.id);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
  // ------------------------------------------------
  // Reads
  // ------------------------------------------------

  async getPost(postId: string): Promise<Post | null> {
    const res = await this.pg.query(
      `SELECT * FROM posts WHERE id = $1`,
      [postId]
    );

    if (!res.rowCount) return null;
    return this.mapPost(res.rows[0]);
  }

  async getThreadPosts(threadId: string): Promise<Post[]> {
    const res = await this.pg.query(
      `SELECT * FROM posts WHERE thread_id = $1 ORDER BY created_at ASC`,
      [threadId]
    );
    return res.rows.map(this.mapPost);
  }

  async getReplies(postId: string): Promise<Post[]> {
    const res = await this.pg.query(
      `SELECT * FROM posts WHERE parent_id = $1 ORDER BY created_at ASC`,
      [postId]
    );
    return res.rows.map(this.mapPost);
  }

  async getPostStats(postId: string) {
    const res = await this.pg.query(
      `
      SELECT
        upvotes,
        downvotes,
        reply_count,
        revision_count,
        updated_at
      FROM posts
      WHERE id = $1
      `,
      [postId]
    );

    if (!res.rowCount) {
      throw new Error("Post not found");
    }

    const row = res.rows[0];

    return {
      upvotes: row.upvotes,
      downvotes: row.downvotes,
      score: row.upvotes - row.downvotes,
      replyCount: row.reply_count,
      revisionCount: row.revision_count,
      lastEditedAt: row.updated_at,
    };
  }

  // ------------------------------------------------
  // Editing / Revisions
  // ------------------------------------------------

  async editPost(params: {
    postId: string;
    editorIri: string;
    newContent: string;
    reason?: string;
  }): Promise<Post> {
    const client = await this.pg.connect();
    try {
      await client.query("BEGIN");

      const current = await client.query(
        `SELECT revision_count FROM posts WHERE id = $1`,
        [params.postId]
      );

      if (!current.rowCount) {
        throw new Error("Post not found");
      }

      const nextRevision = current.rows[0].revision_count + 1;

      await client.query(
        `
        INSERT INTO post_revisions (
          post_id, revision_number, editor_iri, content, edit_reason
        )
        VALUES ($1,$2,$3,$4,$5)
        `,
        [
          params.postId,
          nextRevision,
          params.editorIri,
          params.newContent,
          params.reason ?? null,
        ]
      );

      await client.query(
        `
        UPDATE posts
        SET content = $1,
            revision_count = $2,
            updated_at = NOW()
        WHERE id = $3
        `,
        [params.newContent, nextRevision, params.postId]
      );

      await client.query("COMMIT");

      return this.getPostOrThrow(params.postId);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async getPostRevisions(postId: string): Promise<PostRevision[]> {
    const res = await this.pg.query(
      `
      SELECT * FROM post_revisions
      WHERE post_id = $1
      ORDER BY revision_number DESC
      `,
      [postId]
    );

    return res.rows.map((r) => ({
      id: r.id,
      postId: r.post_id,
      revisionNumber: r.revision_number,
      editorIri: r.editor_iri,
      content: r.content,
      editedAt: r.edited_at,
      editReason: r.edit_reason,
    }));
  }

  async revertPost(params: {
    postId: string;
    revisionNumber: number;
    editorIri: string;
  }): Promise<Post> {
    const rev = await this.pg.query(
      `
      SELECT content FROM post_revisions
      WHERE post_id = $1 AND revision_number = $2
      `,
      [params.postId, params.revisionNumber]
    );

    if (!rev.rowCount) {
      throw new Error("Revision not found");
    }

    return this.editPost({
      postId: params.postId,
      editorIri: params.editorIri,
      newContent: rev.rows[0].content,
      reason: `Reverted to revision ${params.revisionNumber}`,
    });
  }

  // ------------------------------------------------
  // Voting
  // ------------------------------------------------

  async vote(params: {
    postId: string;
    userIri: string;
    value: -1 | 0 | 1;
  }): Promise<Post> {
    const client = await this.pg.connect();
    try {
      await client.query("BEGIN");

      const existing = await client.query(
        `SELECT value FROM post_votes WHERE post_id=$1 AND user_iri=$2`,
        [params.postId, params.userIri]
      );

      if (params.value === 0) {
        if (existing.rowCount) {
          const old = existing.rows[0].value;
          await client.query(
            `DELETE FROM post_votes WHERE post_id=$1 AND user_iri=$2`,
            [params.postId, params.userIri]
          );
          await this.adjustVoteCounters(client, params.postId, -old);
        }
      } else {
        if (!existing.rowCount) {
          await client.query(
            `INSERT INTO post_votes (post_id,user_iri,value)
             VALUES ($1,$2,$3)`,
            [params.postId, params.userIri, params.value]
          );
          await this.adjustVoteCounters(client, params.postId, params.value);
        } else {
          const old = existing.rows[0].value;
          if (old !== params.value) {
            await client.query(
              `UPDATE post_votes SET value=$3 WHERE post_id=$1 AND user_iri=$2`,
              [params.postId, params.userIri, params.value]
            );
            await this.adjustVoteCounters(
              client,
              params.postId,
              params.value - old
            );
          }
        }
      }

      await client.query("COMMIT");
      return this.getPostOrThrow(params.postId);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async getUserVote(postId: string, userIri: string) {
    const res = await this.pg.query(
      `SELECT value FROM post_votes WHERE post_id=$1 AND user_iri=$2`,
      [postId, userIri]
    );

    if (!res.rowCount) return 0;
    return res.rows[0].value as -1 | 1;
  }

  // ------------------------------------------------
  // Moderation
  // ------------------------------------------------

  async softDeletePost(postId: string): Promise<void> {
    await this.pg.query(
      `UPDATE posts SET is_deleted = TRUE WHERE id = $1`,
      [postId]
    );
  }

  // ------------------------------------------------
  // Internal helpers
  // ------------------------------------------------

  async resolveThreadRoot(postId: string): Promise<string> {
    const res = await this.pg.query(
      `SELECT thread_id FROM posts WHERE id = $1`,
      [postId]
    );

    if (res.rowCount === 0) {
      // Not found locally — assume it's the root itself
      return postId;
    }

    return res.rows[0].thread_id;
  }

  private async adjustVoteCounters(
    client: any,
    postId: string,
    delta: number
  ) {
    if (delta > 0) {
      await client.query(
        `UPDATE posts SET upvotes = upvotes + $2 WHERE id=$1`,
        [postId, delta]
      );
    } else {
      await client.query(
        `UPDATE posts SET downvotes = downvotes + $2 WHERE id=$1`,
        [postId, -delta]
      );
    }
  }

  private mapPost = (row: any): Post => ({
    id: row.id,
    threadId: row.thread_id,
    authorIri: row.author_iri,
    content: row.content,
    parentId: row.parent_id,
    upvotes: row.upvotes,
    downvotes: row.downvotes,
    score: row.upvotes - row.downvotes,
    replyCount: row.reply_count,
    revisionCount: row.revision_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isDeleted: row.is_deleted,
  });

  private async getPostOrThrow(id: string): Promise<Post> {
    const post = await this.getPost(id);
    if (!post) throw new Error("Post not found after mutation");
    return post;
  }

  
}