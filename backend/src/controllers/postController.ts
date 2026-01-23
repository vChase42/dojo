// src/controllers/postController.ts

import { Request, Response } from "express";
import { ActivityPubService } from "../services/activitypubService";
import { NoteStatsService } from "../services/NoteStatsService";

export function postController(ap: ActivityPubService, ns: NoteStatsService) {
  return {

    /**
     * POST /api/thread
     * Create a new thread (forum-style)
     */
    async createThread(req: Request, res: Response) {
      try {
        const user = req.user;
        const { title, slug } = req.body;

        if (!title || typeof title !== "string") {
          return res.status(400).json({ error: "title is required" });
        }

        const { threadId } = await ap.createThread(user.actorId, {
          title,
          slug,
        });

        return res.status(201).json({
          ok: true,
          threadId,
        });

      } catch (err: any) {
        console.error("createThread error:", err);
        res.status(500).json({ error: err.message || "Failed to create thread" });
      }
    },

    /**
     * POST /api/post
     * Create a post (wall post, thread post, or reply)
     */
    async createPost(req: Request, res: Response) {
      try {
        const user = req.user;
        const {
          content,
          context,
          inReplyTo,
          to,
          cc,
        } = req.body;

        if (!content || typeof content !== "string") {
          return res.status(400).json({ error: "content is required" });
        }

        const result = await ap.createPost(
          user.actorId,
          content,
          context,
          {
            inReplyTo,
            to,
            cc,
          }
        );

        // Stats updates are local side effects
        if (inReplyTo) {
          await ns.incrementReplies(inReplyTo);
        }

        return res.status(201).json({
          ok: true,
          ...result,
        });

      } catch (err: any) {
        console.error("createPost error:", err);
        res.status(500).json({ error: err.message || "Failed to create post" });
      }
    },

    /**
     * GET /api/threads
     * List threads (local, non-federated)
     */
    async getThreads(req: Request, res: Response) {
      try {
        const threads = await ap.getThreads();
        res.json({ ok: true, items: threads });
      } catch (err: any) {
        console.error("getThreads error:", err);
        res.status(500).json({ error: "Failed to fetch threads" });
      }
    },

    /**
     * GET /api/thread/:id
     * Fetch a single thread object
     */
    async getThread(req: Request, res: Response) {
      try {
        const { id } = req.params;
        const thread = await ap.getThread(id);

        if (!thread) {
          return res.status(404).json({ error: "Thread not found" });
        }

        res.json({ ok: true, thread });

      } catch (err: any) {
        console.error("getThread error:", err);
        res.status(500).json({ error: "Failed to fetch thread" });
      }
    },

    /**
     * GET /api/outbox
     * Return the logged-in user's posts (local only)
     */
    async getMyOutbox(req: Request, res: Response) {
      try {
        const user = req.user;
        const posts = await ap.getOutbox(user.actorId);

        res.json({
          ok: true,
          items: posts,
        });

      } catch (err: any) {
        console.error("getMyOutbox error:", err);
        res.status(500).json({ error: "Failed to fetch outbox" });
      }
    }
  };
}
