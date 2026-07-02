// src/services/postsService.ts

import { Pool } from "pg";
import { Post, PostRevision } from "../types";

import { PostReadService } from "./posts/postReadService";
import { PostVotesService } from "./posts/postVotesService";
import { PostRevisionsService } from "./posts/postRevisionsService";
import { PostModerationService } from "./posts/postModerationService";

export class PostsService {
  private reads: PostReadService;
  private votes: PostVotesService;
  private revisions: PostRevisionsService;
  private moderation: PostModerationService;

  constructor(private pg: Pool) {
    this.reads = new PostReadService(pg);
    this.votes = new PostVotesService(pg, this.reads);
    this.revisions = new PostRevisionsService(pg, this.reads);
    this.moderation = new PostModerationService(pg, this.reads);

    this.initialize();
  }

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

        moderation_status TEXT NOT NULL DEFAULT 'visible',
        deleted_reason TEXT NULL,
        deleted_by TEXT NULL,
        deleted_at TIMESTAMPTZ NULL,

        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await this.pg.query(`
      ALTER TABLE posts
      ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'visible';
    `);

    await this.pg.query(`
      ALTER TABLE posts
      ADD COLUMN IF NOT EXISTS deleted_reason TEXT NULL;
    `);

    await this.pg.query(`
      ALTER TABLE posts
      ADD COLUMN IF NOT EXISTS deleted_by TEXT NULL;
    `);

    await this.pg.query(`
      ALTER TABLE posts
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;
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

        activity_id TEXT NULL,

        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        PRIMARY KEY (post_id, user_iri)
      );
    `);

    await this.pg.query(`
      CREATE INDEX IF NOT EXISTS idx_posts_thread_created
      ON posts(thread_id, created_at);
    `);

    await this.pg.query(`
      CREATE INDEX IF NOT EXISTS idx_posts_parent_created
      ON posts(parent_id, created_at);
    `);

    await this.pg.query(`
      CREATE INDEX IF NOT EXISTS idx_revisions_post_revision
      ON post_revisions(post_id, revision_number DESC);
    `);
  }

  // ------------------------------------------------
  // Creation
  // ------------------------------------------------

async createPost(params: {
  id: string;
  threadId?: string;
  authorIri: string;
  content: string;
  parentId?: string | null;
  publishedAt?: Date;
}): Promise<Post> {
  const client = await this.pg.connect();

  try {
    await client.query("BEGIN");

    let threadId = params.threadId ?? params.id;

    if (!params.threadId && params.parentId) {
      const parent = await client.query(
        `SELECT thread_id FROM posts WHERE id = $1`,
        [params.parentId]
      );

      if (!parent.rowCount) {
        throw new Error("Parent post not found");
      }

      threadId = parent.rows[0].thread_id;
    }

    if (params.parentId) {
      await client.query(
        `
        UPDATE posts
        SET
          reply_count = reply_count + 1,
          updated_at = NOW()
        WHERE id = $1
        `,
        [params.parentId]
      );
    }

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
      VALUES ($1, $2, $3, $4, $5, $6, $6)
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

    await client.query(
      `
      INSERT INTO post_revisions (
        post_id,
        revision_number,
        editor_iri,
        content
      )
      VALUES ($1, 1, $2, $3)
      `,
      [params.id, params.authorIri, params.content]
    );

    await client.query("COMMIT");

    return this.getPostOrThrow(params.id, params.authorIri);
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
    return this.reads.getPost({ postId });
  }

  async getThreadPosts(params: {
    threadId: string;
    viewerIri?: string | null;
    limit?: number;
    offset?: number;
  }) {
    return this.reads.getThreadPosts(params);
  }

  async getReplies(params: {
    postId: string;
    viewerIri?: string | null;
    limit?: number;
    offset?: number;
  }) {
    return this.reads.getReplies(params);
  }

  async getPostStats(postId: string) {
    return this.reads.getPostStats(postId);
  }

  async resolveThreadRoot(postId: string): Promise<string> {
    return this.reads.resolveThreadRoot(postId);
  }

  // ------------------------------------------------
  // Voting
  // ------------------------------------------------

  async vote(params: {
    postId: string;
    userIri: string;
    value: -1 | 0 | 1;
    activityId?: string | null;
  }): Promise<Post> {
    return this.votes.vote(params);
  }

  async getUserVote(
    postId: string,
    userIri: string
  ): Promise<-1 | 0 | 1> {
    return this.votes.getUserVote(postId, userIri);
  }

  async getVoteActivityId(
    postId: string,
    userIri: string
  ): Promise<string | null> {
    return this.votes.getVoteActivityId(postId, userIri);
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
    return this.revisions.editPost(params);
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
    return this.revisions.getPostRevisions(params);
  }

  async revertPost(params: {
    postId: string;
    revisionNumber: number;
    editorIri: string;
  }): Promise<Post> {
    return this.revisions.revertPost(params);
  }

  // ------------------------------------------------
  // Moderation
  // ------------------------------------------------

  async softDeletePost(params: {
    postId: string;
    deletedBy: string;
    reason?: string;
  }): Promise<Post> {
    return this.moderation.softDeletePost(params);
  }

  async restorePost(params: {
    postId: string;
    restoredBy: string;
  }): Promise<Post> {
    return this.moderation.restorePost(params);
  }

  async hidePost(params: {
    postId: string;
    moderatorIri: string;
    reason?: string;
  }): Promise<Post> {
    return this.moderation.hidePost(params);
  }

  async unhidePost(params: {
    postId: string;
    moderatorIri: string;
  }): Promise<Post> {
    return this.moderation.unhidePost(params);
  }

  // ------------------------------------------------
  // Internal helpers
  // ------------------------------------------------

  private async getPostOrThrow(
    postId: string,
    viewerIri?: string | null
  ): Promise<Post> {
    const post = await this.reads.getPost({
      postId,
      viewerIri,
    });

    if (!post) {
      throw new Error("Post not found after mutation");
    }

    return post;
  }
}