// src/controllers/threadController.ts

import { Request, Response } from "express";
import { ActivityPubService } from "../services/activitypubService";
import { ThreadService } from "../services/threadService";
import { PostsService } from "../services/postsService";
import { Thread } from "../types";

export function ThreadController(
  ap: ActivityPubService,
  ts: ThreadService,
  ps: PostsService
) {
  return {
    /**
     * POST /api/thread
     * Create a new thread
     */
    async createThread(req: Request, res: Response) {
      try {
        const user = req.user as any;
        const { title, groupContext: groupIri } = req.body;

        if (!groupIri || typeof groupIri !== "string") {
          return res.status(400).json({ error: "groupContext is required" });
        }

        if (!title || typeof title !== "string") {
          return res.status(400).json({ error: "title is required" });
        }

        // 1️⃣ Create AP root note
        const { noteId } = await ap.createNote(
          user.actorId,
          title,
          groupIri,
          { to: [groupIri] }
        );

        if (!noteId) {
          throw new Error("Failed to obtain noteId from ActivityPub");
        }

        // 2️⃣ Create thread row
        await ts.createThread({
          groupIri,
          rootNoteIri: noteId,
          title,
          creatorIri: user.actorId,
        });

        // 3️⃣ Create root post row
        await ps.createPost({
          id: noteId,
          authorIri: user.actorId,
          content: title,
          parentId: null,
        });

        return res.status(201).json({
          ok: true,
          noteId,
        });
      } catch (err: any) {
        console.error("createThread error:", err);
        return res
          .status(500)
          .json({ error: err.message || "Failed to create thread" });
      }
    },

    /**
     * GET /api/threads?groupIRI=...
     * List threads by group
     */
    async getThreads(req: Request, res: Response) {
      try {
        const { groupIRI } = req.query;


        if (!groupIRI || typeof groupIRI !== "string") {
          return res
            .status(400)
            .json({ error: "groupIRI is required and must be string" });
        }

        const threads: Thread[] = await ts.listByGroup(groupIRI);
        return res.json({
          ok: true,
          items: threads,
        });
      } catch (err: any) {
        console.error("getThreads error:", err);
        return res.status(500).json({ error: "Failed to fetch threads" });
      }
    },

    /**
     * GET /api/thread/stats?threadIri=...
     */
    async getThreadStats(req: Request, res: Response) {
      try {
        const { threadIri } = req.query;

        if (!threadIri || typeof threadIri !== "string") {
          return res
            .status(400)
            .json({ error: "threadIri is required and must be string" });
        }

        const thread = await ts.getByRootNote(threadIri);

        if (!thread) {
          return res
            .status(404)
            .json({ error: `No thread found for ${threadIri}` });
        }

        return res.json({ thread });
      } catch (err: any) {
        console.error("getThreadStats error:", err);
        return res.status(500).json({ error: "Failed to fetch thread stats" });
      }
    },
  };
}