// src/controllers/replyController.ts

import { Request, Response } from "express";
import { ActivityPubService } from "../services/activitypubService";
import { NoteStatsService } from "../services/NoteStatsService";
import { ThreadStatsService } from "../services/ThreadStatsService";

export function ReplyController(
  ap: ActivityPubService,
  ns: NoteStatsService,
  ts: ThreadStatsService
) {
  return {
    /**
     * POST /api/post
     * Create a post (wall, thread reply, etc.)
     */
    async createPost(req: Request, res: Response) {
      try {
        const user = req.user as any;

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

        // Local side effects
        if (inReplyTo) {
          await ns.incrementReplies(inReplyTo);

          const root = await ap.resolveThreadRoot(inReplyTo);
          if (root) {
            await ts.incrementReplies(root);
          }
        }

        return res.status(201).json({
          ok: true,
          ...result,
        });
      } catch (err: any) {
        console.error("createPost error:", err);
        return res
          .status(500)
          .json({ error: err.message || "Failed to create post" });
      }
    },
  };
}
