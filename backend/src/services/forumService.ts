// src/services/forumService.ts

import { ActivityPubService } from "./activitypubService";
import { PostsService } from "./postsService";
import { ThreadService } from "./threadService";

export class ForumService {
  constructor(
    private ap: ActivityPubService,
    private posts: PostsService,
    private threads: ThreadService
  ) {}

  // ------------------------------------------------
  // User Workflows
  // ------------------------------------------------

  /**
   * Create a new discussion thread.
   *
   * Creates:
   *  - ActivityPub Note
   *  - Thread row
   *  - Root post
   */
  async createThread(params: {
    actorIri: string;
    title: string;
    groupIri: string;
  }): Promise<{
    noteId: string;
  }> {
    const { noteId } = await this.ap.createNote(
      params.actorIri,
      params.title,
      params.groupIri,
      {
        to: [params.groupIri],
      }
    );

    if (!noteId) {
      throw new Error("Failed to obtain noteId from ActivityPub");
    }

    await this.threads.createThread({
      groupIri: params.groupIri,
      rootNoteIri: noteId,
      title: params.title,
      creatorIri: params.actorIri,
    });

    await this.posts.createPost({
      id: noteId,
      threadId: noteId,
      authorIri: params.actorIri,
      content: params.title,
      parentId: null,
    });

    return {
      noteId,
    };
  }

  /**
   * Create a reply (or non-root post) through ActivityPub.
   */
  async createPost(params: {
    actorIri: string;
    content: string;
    context: string;
    inReplyTo?: string | undefined;
    to?: string[];
    cc?: string[];
    published?: string;
  }): Promise<{
    noteId: string;
  }> {
    const result = await this.ap.createNote(
      params.actorIri,
      params.content,
      params.context,
      {
        inReplyTo: params.inReplyTo,
        to: params.to,
        cc: params.cc,
        published: params.published,
      }
    );

    const noteId = result.noteId;

    if (!noteId) {
      throw new Error("Failed to obtain noteId from ActivityPub");
    }

    await this.posts.createPost({
      id: noteId,
      authorIri: params.actorIri,
      content: params.content,
      parentId: params.inReplyTo ?? null,
    });

    if (params.inReplyTo) {
      const threadRoot = await this.posts.resolveThreadRoot(
        params.inReplyTo
      );

      await this.threads.incrementReplies(
        threadRoot,
        params.published
      );
    }

    return {
      noteId,
    };
  }

  /**
   * Edit a post.
   */
  async editPost(params: {
    actorIri: string;
    noteIri: string;
    content: string;
    reason?: string;
  }) {
    const post = await this.posts.editPost({
      postId: params.noteIri,
      editorIri: params.actorIri,
      newContent: params.content,
      reason: params.reason,
    });

    await this.ap.updateNote(
      params.actorIri,
      params.noteIri,
      params.content
    );

    return post;
  }

  /**
   * Delete a post.
   */
  async deletePost(params: {
    actorIri: string;
    noteIri: string;
    reason?: string;
  }) {
    const post = await this.posts.softDeletePost({
      postId: params.noteIri,
      deletedBy: params.actorIri,
      reason: params.reason,
    });

    await this.ap.deleteNote(
      params.actorIri,
      params.noteIri
    );

    return post;
  }

  /**
   * Vote on a post.
   */
  async votePost(params: {
    actorIri: string;
    noteIri: string;
    value: -1 | 0 | 1;
  }) {
    let activityId: string | null = null;

    if (params.value === 1) {
      const result = await this.ap.likeObject(
        params.actorIri,
        params.noteIri
      );

      activityId = result.activityId ?? null;
    }

    if (params.value === 0) {
      const existing = await this.posts.getVoteActivityId(
        params.noteIri,
        params.actorIri
      );

      if (existing) {
        await this.ap.undoLike(
          params.actorIri,
          existing
        );
      }
    }

    return this.posts.vote({
      postId: params.noteIri,
      userIri: params.actorIri,
      value: params.value,
      activityId,
    });
  }

  // ------------------------------------------------
  // Import Workflows
  // ------------------------------------------------

  /**
   * Import a thread from an external source (Reddit, Lemmy export, etc.)
   *
   * No ActivityPub objects are created.
   */
  async importThread(params: {
    id: string;
    actorIri: string;
    title: string;
    groupIri: string;
    publishedAt?: Date;
  }): Promise<{
    noteId: string;
  }> {
    await this.threads.createThread({
      groupIri: params.groupIri,
      rootNoteIri: params.id,
      title: params.title,
      creatorIri: params.actorIri,
      publishedAt: params.publishedAt?.toISOString(),
    });

    await this.posts.createPost({
      id: params.id,
      threadId: params.id,
      authorIri: params.actorIri,
      content: params.title,
      parentId: null,
      publishedAt: params.publishedAt,
    });

    return {
      noteId: params.id,
    };
  }

  /**
   * Import a reply from an external source.
   *
   * Assumes:
   *  - thread already exists
   *  - parent post already exists
   *
   * No ActivityPub objects are created.
   */
  async importPost(params: {
    id: string;
    threadId: string;
    actorIri: string;
    content: string;
    parentId: string;
    publishedAt?: Date;
  }): Promise<{
    noteId: string;
  }> {
    await this.posts.createPost({
      id: params.id,
      threadId: params.threadId,
      authorIri: params.actorIri,
      content: params.content,
      parentId: params.parentId,
      publishedAt: params.publishedAt,
    });

    await this.threads.incrementReplies(
      params.threadId,
      params.publishedAt?.toISOString()
    );

    return {
      noteId: params.id,
    };
  }
}