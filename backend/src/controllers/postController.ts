// src/controllers/postController.ts

import { Request, Response } from "express";
import { ActivityPubService } from "../services/activitypubService";

export function postController(ap: ActivityPubService) {
  return {
    /**
     * POST /api/post
     * Create a post as the authenticated user.
     */
    async createPost(req: Request, res: Response) {
      try {
        const user = req.user; // injected by requireAuth()
        const { content } = req.body;

        if (!content || typeof content !== "string") {
          return res.status(400).json({ error: "content is required" });
        }

        const actorId = user.actorId; // set by UserService

        const result = await ap.createPost(actorId, content);

        return res.status(201).json({
          ok: true,
          note: result.note,
          activity: result.activity
        });

      } catch (err: any) {
        console.error("createPost error:", err);
        res.status(500).json({ error: "Failed to create post" });
      }
    },

    /**
     * GET /api/outbox
     * Return the logged-in user's posts (local only, no federation).
     */
    async getMyOutbox(req: Request, res: Response) {
      try {
        const user = req.user; // injected by requireAuth()
        const actorId = user.actorId;

        const posts = await ap.getOutbox(actorId);

        res.json({
          ok: true,
          items: posts
        });

      } catch (err: any) {
        console.error("getMyOutbox error:", err);
        res.status(500).json({ error: "Failed to fetch outbox" });
      }
    }
  };
}
