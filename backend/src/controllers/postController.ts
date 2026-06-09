// src/controllers/replyController.ts

import { Request, Response } from "express";
import { ActivityPubService } from "../services/activitypubService";
import { PostsService } from "../services/postsService";
import { ThreadService } from "../services/threadService";

export function PostController(
  ap: ActivityPubService,
  ps: PostsService,
  ts: ThreadService
) {
  return {
    /**
     * POST /api/post
     * Create a post (root or reply)
     */
    async createPost(req: Request, res: Response) {
      try {
        const user = req.user as any;

        const { content, context, inReplyTo, to, cc } = req.body;

        if (!content || typeof content !== "string") {
          return res.status(400).json({ error: "content is required" });
        }

        if (!context || typeof context !== "string") {
          return res.status(400).json({ error: "context is required" });
        }

        // 1️⃣ Create AP Note
        const result = await ap.createNote(
          user.actorId,
          content,
          context,
          {
            inReplyTo,
            to,
            cc,
            published: new Date().toISOString(),
          }
        );

        const noteId = result.noteId;
        if (!noteId) {
          throw new Error("Failed to obtain noteId from ActivityPub");
        }

        // 2️⃣ Persist locally (threadId inferred internally)
        await ps.createPost({
          id: noteId,
          authorIri: user.actorId,
          content,
          parentId: inReplyTo ?? null,
        });

        // 3️⃣ If reply, bump thread aggregate count
        if (inReplyTo) {
          // resolve via PostsService instead of ActivityPub
          const threadRoot = await ps.resolveThreadRoot(inReplyTo);
          await ts.incrementReplies(threadRoot);
        }

        return res.status(201).json({
          ok: true,
          noteId,
        });
      } catch (err: any) {
        console.error("createPost error:", err);
        return res
          .status(500)
          .json({ error: err.message || "Failed to create post" });
      }
    },

    /**
     * POST /api/editpost
     * Edit a post
     */
    async editPost(req: Request, res: Response) {
      try {
        const user = req.user as any;
        const { noteIri, content, reason } = req.body;

        if (!noteIri || typeof noteIri !== "string") {
          return res.status(400).json({ error: "noteIri (string) required" });
        }

        if (!content || typeof content !== "string") {
          return res.status(400).json({ error: "content (string) is required" });
        }

        const updatedPost = await ps.editPost({
          postId: noteIri,
          editorIri: user.actorId,
          newContent: content,
          reason,
        });

        return res.status(200).json({
          ok: true,
          post: updatedPost,
        });
      } catch (err: any) {
        console.error("editPost error:", err);
        return res
          .status(500)
          .json({ error: err.message || "Failed to edit post" });
      }
    },

    /**
     * GET /api/thread/:threadId
     * Fetch all posts for a thread
     */
    async getThreadPosts(req: Request, res: Response) {
      try {
        const { threadId } = req.params;

        if (!threadId) {
          return res.status(400).json({ error: "threadId required" });
        }

        const user = req.user as any;
        const viewerIri = user?.actorId ?? null;

        const page = Math.max(Number(req.query.page ?? 1), 1);
        const limit = Math.min(Math.max(Number(req.query.limit ?? 50), 1), 100);
        const offset = (page - 1) * limit;

        const result = await ps.getThreadPosts({
          threadId,
          viewerIri,
          limit,
          offset,
        });

        const threadMeta = await ts.getByRootNote(threadId);

        return res.status(200).json({
          ok: true,
          thread: threadMeta,
          posts: result.posts,
          pagination: {
            page,
            limit: result.limit,
            offset: result.offset,
            total: result.total,
            totalPages: Math.ceil(result.total / result.limit),
            hasNextPage: result.offset + result.posts.length < result.total,
            hasPreviousPage: page > 1,
          },
        });
      } catch (err: any) {
        console.error("getThreadPosts error:", err);

        return res.status(500).json({
          error: err.message || "Failed to fetch thread",
        });
      }
    },
  };
}