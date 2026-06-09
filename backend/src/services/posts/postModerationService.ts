import { Pool } from "pg";
import { Post } from "../../types";
import { PostReadService } from "./postReadService";

export class PostModerationService {
  constructor(
    private pg: Pool,
    private reads: PostReadService
  ) {}

  async softDeletePost(params: {
    postId: string;
    deletedBy: string;
    reason?: string;
  }): Promise<Post> {
    await this.pg.query(
      `
      UPDATE posts
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
        params.postId,
        params.reason ?? null,
        params.deletedBy,
      ]
    );

    return this.getPostOrThrow(
      params.postId,
      params.deletedBy
    );
  }

  async restorePost(params: {
    postId: string;
    restoredBy: string;
  }): Promise<Post> {
    await this.pg.query(
      `
      UPDATE posts
      SET
        is_deleted = FALSE,
        moderation_status = 'visible',
        deleted_reason = NULL,
        deleted_by = NULL,
        deleted_at = NULL,
        updated_at = NOW()
      WHERE id = $1
      `,
      [params.postId]
    );

    return this.getPostOrThrow(
      params.postId,
      params.restoredBy
    );
  }

  async hidePost(params: {
    postId: string;
    moderatorIri: string;
    reason?: string;
  }): Promise<Post> {
    await this.pg.query(
      `
      UPDATE posts
      SET
        moderation_status = 'hidden',
        deleted_reason = $2,
        deleted_by = $3,
        updated_at = NOW()
      WHERE id = $1
      `,
      [
        params.postId,
        params.reason ?? null,
        params.moderatorIri,
      ]
    );

    return this.getPostOrThrow(
      params.postId,
      params.moderatorIri
    );
  }

  async unhidePost(params: {
    postId: string;
    moderatorIri: string;
  }): Promise<Post> {
    await this.pg.query(
      `
      UPDATE posts
      SET
        moderation_status = 'visible',
        deleted_reason = NULL,
        deleted_by = NULL,
        updated_at = NOW()
      WHERE id = $1
      `,
      [params.postId]
    );

    return this.getPostOrThrow(
      params.postId,
      params.moderatorIri
    );
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
      throw new Error("Post not found after moderation mutation");
    }

    return post;
  }
}