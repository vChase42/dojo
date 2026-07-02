// src/controllers/threadController.ts

import { Request, Response } from "express";
import { ForumService } from "../services/forumService";
import { ThreadService } from "../services/threadService";

export function ThreadController(
  forum: ForumService,
  ts: ThreadService
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
          return res.status(400).json({
            error: "groupContext is required",
          });
        }

        if (!title || typeof title !== "string") {
          return res.status(400).json({
            error: "title is required",
          });
        }

        const { noteId } = await forum.createThread({
          actorIri: user.actorId,
          title,
          groupIri,
        });

        return res.status(201).json({
          ok: true,
          noteId,
        });
      } catch (err: any) {
        console.error("createThread error:", err);

        return res.status(500).json({
          error: err.message || "Failed to create thread",
        });
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
          return res.status(400).json({
            error: "groupIRI is required and must be string",
          });
        }

        const page = Math.max(Number(req.query.page ?? 1), 1);
        const limit = Math.min(
          Math.max(Number(req.query.limit ?? 50), 1),
          100
        );
        const offset = (page - 1) * limit;

        const result = await ts.listByGroup({
          groupIri: groupIRI,
          limit,
          offset,
        });

        return res.json({
          ok: true,
          items: result.items,
          pagination: {
            page,
            limit: result.limit,
            offset: result.offset,
            total: result.total,
            totalPages: Math.ceil(result.total / result.limit),
            hasNextPage:
              result.offset + result.items.length < result.total,
            hasPreviousPage: page > 1,
          },
        });
      } catch (err: any) {
        console.error("getThreads error:", err);

        return res.status(500).json({
          error: "Failed to fetch threads",
        });
      }
    },

    /**
     * GET /api/thread/stats?threadIri=...
     */
    async getThreadStats(req: Request, res: Response) {
      try {
        const { threadIri } = req.query;

        if (!threadIri || typeof threadIri !== "string") {
          return res.status(400).json({
            error: "threadIri is required and must be string",
          });
        }

        const thread = await ts.getByRootNote(threadIri);

        if (!thread) {
          return res.status(404).json({
            error: `No thread found for ${threadIri}`,
          });
        }

        return res.json({
          thread,
        });
      } catch (err: any) {
        console.error("getThreadStats error:", err);

        return res.status(500).json({
          error: "Failed to fetch thread stats",
        });
      }
    },
  };
}