import { Pool } from "pg";
import { Post } from "../../types";
import { mapPost } from "./postMapper";

export class PostReadService {
  constructor(private pg: Pool) {}

  async getPost(params: {
    postId: string;
    viewerIri?: string | null;
  }): Promise<Post | null> {
    const res = await this.pg.query(
      `
      SELECT
        p.*,
        COALESCE(v.value, 0) AS viewer_vote
      FROM posts p
      LEFT JOIN post_votes v
        ON v.post_id = p.id
        AND v.user_iri = $2
      WHERE p.id = $1
      `,
      [params.postId, params.viewerIri ?? ""]
    );

    if (!res.rowCount) return null;

    return mapPost(res.rows[0], params.viewerIri);
  }

  async getThreadPosts(params: {
    threadId: string;
    viewerIri?: string | null;
    limit?: number;
    offset?: number;
  }): Promise<{
    posts: Post[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const limit = Math.min(params.limit ?? 50, 100);
    const offset = Math.max(params.offset ?? 0, 0);

    const totalRes = await this.pg.query(
      `
      SELECT COUNT(*)::int AS total
      FROM posts
      WHERE thread_id = $1
      `,
      [params.threadId]
    );

    const res = await this.pg.query(
      `
      SELECT
        p.*,
        COALESCE(v.value, 0) AS viewer_vote
      FROM posts p
      LEFT JOIN post_votes v
        ON v.post_id = p.id
        AND v.user_iri = $4
      WHERE p.thread_id = $1
      ORDER BY p.created_at ASC
      LIMIT $2
      OFFSET $3
      `,
      [
        params.threadId,
        limit,
        offset,
        params.viewerIri ?? "",
      ]
    );

    return {
      posts: res.rows.map((row) => mapPost(row, params.viewerIri)),
      total: totalRes.rows[0].total,
      limit,
      offset,
    };
  }

  async getReplies(params: {
    postId: string;
    viewerIri?: string | null;
    limit?: number;
    offset?: number;
  }): Promise<{
    replies: Post[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const limit = Math.min(params.limit ?? 50, 100);
    const offset = Math.max(params.offset ?? 0, 0);

    const totalRes = await this.pg.query(
      `
      SELECT COUNT(*)::int AS total
      FROM posts
      WHERE parent_id = $1
      `,
      [params.postId]
    );

    const res = await this.pg.query(
      `
      SELECT
        p.*,
        COALESCE(v.value, 0) AS viewer_vote
      FROM posts p
      LEFT JOIN post_votes v
        ON v.post_id = p.id
        AND v.user_iri = $4
      WHERE p.parent_id = $1
      ORDER BY p.created_at ASC
      LIMIT $2
      OFFSET $3
      `,
      [
        params.postId,
        limit,
        offset,
        params.viewerIri ?? "",
      ]
    );

    return {
      replies: res.rows.map((row) => mapPost(row, params.viewerIri)),
      total: totalRes.rows[0].total,
      limit,
      offset,
    };
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

  async resolveThreadRoot(postId: string): Promise<string> {
    const res = await this.pg.query(
      `SELECT thread_id FROM posts WHERE id = $1`,
      [postId]
    );

    if (res.rowCount === 0) {
      return postId;
    }

    return res.rows[0].thread_id;
  }
}