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
            published: new Date().toISOString(),
          }
        );

        //adding it to the collection is also a locally managed side effect.
        if (context) {
          await ap.addNoteToOrderedCollection(user.actorId, context, result.noteId);
        }


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
        const thread = await ap.getCollection(id);
        
        if (!thread) {
          return res.status(404).json({ error: "Thread not found" });
        }
        
        res.json({ thread });
        
      } catch (err: any) {
        console.error("getThread error:", err);
        res.status(500).json({ error: "Failed to fetch thread" });
      }
    },

    /**
     * GET /api/outbox
     * Return the logged-in user's posts (local only)
     */
    async getPost(req: Request, res: Response) {
      try {
        const {id} = req.params;
        const post = ap.getPost(id);
        
        res.json({
          post,
        });

        
      } catch (err: any) {
        console.error("getMyOutbox error:", err);
        res.status(500).json({ error: "Failed to fetch outbox" });
      }
    },

    async getWall(req: Request, res: Response){
      try {
        const user = req.user;
        // const { page } = req.params;
        ap.getWall(user);

        //stub
      } catch (err: any){
        console.error("getWall error:", err);
        res.status(500).json({ error: "Failed to fetch getWall " });
      }
    },
  };
}
