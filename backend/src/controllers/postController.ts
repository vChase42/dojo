// src/controllers/postController.ts

import { Request, Response } from "express";
import { ActivityPubService } from "../services/activitypubService";
import crypto from "crypto";

export function postController(ap: ActivityPubService) {
  return {
    /**
     * POST /api/post
     * Create a post as the authenticated user.
     */
    async createPost(req: Request, res: Response) {
      try {
        const user = req.user; // added by requireAuth()
        const { content } = req.body;

        if (!content || typeof content !== "string") {
          return res.status(400).json({ error: "content is required" });
        }

        const actorId = user.actorId; // ex: "https://localhost/u/chase"
        const outboxUrl = `${actorId}/outbox`;

        // ---- IMPORTANT ----
        // APEx supports "Client-to-Server (C2S) Create" with a *bare Note object*.
        // You do NOT send a fully wrapped Create activity.
        // You send ONLY the Note, and APEx wraps it in Create automatically.
        // -------------------

        const note = {
          "@context": "https://www.w3.org/ns/activitystreams",
          type: "Note",
          attributedTo: actorId,
          content: content,
          to: ["https://www.w3.org/ns/activitystreams#Public"]
        };

        const response = await fetch(outboxUrl, {
          method: "POST",
          headers: { 
            "Content-Type": "application/activity+json",
            "Authorization": `Bearer ${process.env.ADMIN_SECRET}`
          },
          
          body: JSON.stringify(note)
        });

        if (!response.ok) {
          const errText = await response.text();
          console.error("APEx outbox rejected post:", errText);
          return res.status(500).json({
            error: "ActivityPub outbox rejected post",
            details: errText
          });
        }
        const activityUrl = response.headers.get("location");

        return res.status(201).json({
          ok: true,
          activityUrl
        });

      } catch (err: any) {
        console.error("createPost error:", err);
        return res.status(500).json({ error: "Failed to create post" });
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
