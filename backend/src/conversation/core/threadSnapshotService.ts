// src/conversation/core/threadSnapshotService.ts

import { Post } from "../../types";
import { ThreadService } from "../../services/threadService";
import { PostsService } from "../../services/postsService";
import {
  ConversationEdge,
  ThreadSnapshot,
} from "./types";

export class ThreadSnapshotService {
  constructor(
    private threads: ThreadService,
    private posts: PostsService
  ) {}

  async load(threadId: string): Promise<ThreadSnapshot> {
    const thread = await this.threads.getByRootNote(threadId);

    if (!thread) {
      throw new Error(`Thread not found: ${threadId}`);
    }

    const { posts } = await this.posts.getThreadPosts({
      threadId,
      limit: Number.MAX_SAFE_INTEGER,
    });

    const postsById = new Map<string, Post>(
      posts.map((post) => [post.id, post])
    );

    const rootPost = postsById.get(threadId);

    if (!rootPost) {
      throw new Error(`Thread root post not found: ${threadId}`);
    }

    const childrenByParentId = new Map<string, Post[]>();
    const edges: ConversationEdge[] = [];

    for (const post of posts) {
      if (!post.parentId) continue;

      const children =
        childrenByParentId.get(post.parentId) ?? [];

      children.push(post);
      childrenByParentId.set(post.parentId, children);

      edges.push({
        parentId: post.parentId,
        childId: post.id,
      });
    }

    const participants = [
      ...new Set(posts.map((post) => post.authorIri)),
    ];

    return {
      thread,
      posts,
      rootPost,
      postsById,
      childrenByParentId,
      edges,
      participants,
      capturedAt: new Date(),
    };
  }
}