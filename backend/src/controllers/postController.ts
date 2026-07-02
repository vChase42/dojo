// src/controllers/postController.ts

import { Request, Response } from "express";
import { ForumService } from "../services/forumService";
import { PostsService } from "../services/postsService";
import { ThreadService } from "../services/threadService";

export function PostController(
  forum: ForumService,
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

        const { noteId } = await forum.createPost({
          actorIri: user.actorId,
          content,
          context,
          inReplyTo,
          to,
          cc,
          published: new Date().toISOString(),
        });

        return res.status(201).json({ ok: true, noteId });
      } catch (err: any) {
        console.error("createPost error:", err);
        return res.status(500).json({ error: err.message || "Failed to create post" });
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

        const post = await forum.editPost({
          actorIri: user.actorId,
          noteIri,
          content,
          reason,
        });

        return res.status(200).json({ ok: true, post });
      } catch (err: any) {
        console.error("editPost error:", err);
        return res.status(500).json({ error: err.message || "Failed to edit post" });
      }
    },

    /**
     * GET /api/thread/:threadId
     * Fetch posts for a thread
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
        return res.status(500).json({ error: err.message || "Failed to fetch thread" });
      }
    },

    /**
     * POST /api/deletepost
     * Soft-delete a post
     */
    async deletePost(req: Request, res: Response) {
      try {
        const user = req.user as any;
        const { noteIri, reason } = req.body;

        if (!noteIri || typeof noteIri !== "string") {
          return res.status(400).json({ error: "noteIri (string) required" });
        }

        const post = await forum.deletePost({
          actorIri: user.actorId,
          noteIri,
          reason,
        });

        return res.status(200).json({ ok: true, post });
      } catch (err: any) {
        console.error("deletePost error:", err);
        return res.status(500).json({ error: err.message || "Failed to delete post" });
      }
    },

    /**
     * POST /api/votepost
     * Vote, change vote, or clear vote
     */
    async votePost(req: Request, res: Response) {
      try {
        const user = req.user as any;
        const { noteIri, value } = req.body;

        if (!noteIri || typeof noteIri !== "string") {
          return res.status(400).json({ error: "noteIri (string) required" });
        }

        if (![1, 0, -1].includes(value)) {
          return res.status(400).json({ error: "value must be -1, 0, or 1" });
        }

        const post = await forum.votePost({
          actorIri: user.actorId,
          noteIri,
          value,
        });

        return res.status(200).json({ ok: true, post });
      } catch (err: any) {
        console.error("votePost error:", err);
        return res.status(500).json({ error: err.message || "Failed to vote on post" });
      }
    },
  };
}