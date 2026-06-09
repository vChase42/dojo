import { Pool } from "pg";
import { Post, PostRevision } from "../../types";
import { PostReadService } from "./postReadService";

export class PostRevisionsService {
  constructor(
    private pg: Pool,
    private reads: PostReadService
  ) {}

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
        `
        SELECT revision_count
        FROM posts
        WHERE id = $1
        FOR UPDATE
        `,
        [params.postId]
      );

      if (!current.rowCount) {
        throw new Error("Post not found");
      }

      const nextRevision = current.rows[0].revision_count + 1;

      await client.query(
        `
        INSERT INTO post_revisions (
          post_id,
          revision_number,
          editor_iri,
          content,
          edit_reason
        )
        VALUES ($1, $2, $3, $4, $5)
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
        SET
          content = $1,
          revision_count = $2,
          updated_at = NOW()
        WHERE id = $3
        `,
        [
          params.newContent,
          nextRevision,
          params.postId,
        ]
      );

      await client.query("COMMIT");

      return this.getPostOrThrow(
        params.postId,
        params.editorIri
      );
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async getPostRevisions(params: {
    postId: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    revisions: PostRevision[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const limit = Math.min(params.limit ?? 50, 100);
    const offset = Math.max(params.offset ?? 0, 0);

    const totalRes = await this.pg.query(
      `
      SELECT COUNT(*)::int AS total
      FROM post_revisions
      WHERE post_id = $1
      `,
      [params.postId]
    );

    const res = await this.pg.query(
      `
      SELECT *
      FROM post_revisions
      WHERE post_id = $1
      ORDER BY revision_number DESC
      LIMIT $2
      OFFSET $3
      `,
      [params.postId, limit, offset]
    );

    return {
      revisions: res.rows.map((row) =>
        this.mapRevision(row)
      ),
      total: totalRes.rows[0].total,
      limit,
      offset,
    };
  }

  async revertPost(params: {
    postId: string;
    revisionNumber: number;
    editorIri: string;
  }): Promise<Post> {
    const rev = await this.pg.query(
      `
      SELECT content
      FROM post_revisions
      WHERE post_id = $1
        AND revision_number = $2
      `,
      [
        params.postId,
        params.revisionNumber,
      ]
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

  private mapRevision(row: any): PostRevision {
    return {
      id: row.id,
      postId: row.post_id,
      revisionNumber: row.revision_number,
      editorIri: row.editor_iri,
      content: row.content,
      editedAt: row.edited_at,
      editReason: row.edit_reason,
    };
  }

  private async getPostOrThrow(
    postId: string,
    viewerIri: string
  ): Promise<Post> {
    const post = await this.reads.getPost({
      postId,
      viewerIri,
    });

    if (!post) {
      throw new Error("Post not found after revision mutation");
    }

    return post;
  }
}