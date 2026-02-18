// src/controllers/postController.ts

import { Request, Response } from "express";
import { ActivityPubService } from "../services/activitypubService";
import { NoteStatsService } from "../services/NoteStatsService";
import { ThreadStats, ThreadStatsService } from "../services/ThreadStatsService";

export function postController(ap: ActivityPubService, ns: NoteStatsService, ts: ThreadStatsService, mdb: any) {
  return {

    /**
     * POST /api/group
     * Create a new group
    */
    async createGroup(req: Request, res: Response){
      try{
        const {groupName, summary} = req.body;

        if (!groupName || typeof groupName !== "string") {
          return res.status(400).json({ error: "groupName is required" });
        }
        if(summary && typeof summary !== "string"){
          return res.status(400).json({ error: "summary must be a string"});
        }
        
        const groupId = await ap.createGroup(groupName, {summary: summary, discoverable: true});
      
        return res.status(201).json({
          ok: true,
          groupId,
        });

      }catch(err: any){
        console.error("createGroup error:", err);
        res.status(500).json({ error: err.message || "Failed to create group" });
      }
    },

    /**
     * POST /api/thread
     * Create a new thread (forum-style)
     */
    async createThread(req: Request, res: Response) {
      try {
        const user = req.user;
        const { title, groupContext: groupIri } = req.body;

        if (!groupIri || typeof groupIri !== "string") {
         return res.status(400).json({ error: "groupContext is required" });
        }
        if (!title || typeof title !== "string") {
          return res.status(400).json({ error: "title is required" });
        }

        const { noteId, activityId } = await ap.createNote(user.actorId, title, groupIri, {to: [groupIri]});
        await ts.createThread({
          groupIri,
          rootNoteIri: noteId,
          title,
          creatorIri: user.actorId
        });

        return res.status(201).json({
          ok: true,
          noteId,
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


        // Stats updates are local side effects
        if (inReplyTo) {
          await ns.incrementReplies(inReplyTo);
          const root = await ap.resolveThreadRoot(inReplyTo);
          if(root){
            await ts.incrementReplies(root)
          }
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
        const {groupIRI} = req.query;
        if(!groupIRI || typeof groupIRI !== "string"){
          return res.status(400).json({ error: "groupIRI is required and must be string"});
        }
        const threads: ThreadStats[] = await ts.listByGroup(groupIRI);
        res.json({ ok: true, items: threads });
      } catch (err: any) {
        console.error("getThreads error:", err);
        res.status(500).json({ error: "Failed to fetch threads" });
      }
    },


    async getThreadStats(req: Request, res: Response){
      try{
        const {threadIri} = req.query;
        if(!threadIri || typeof threadIri !== "string"){
          return res.status(400).json({ error: "threadIri is required and must be string"});
        }
        const thread: ThreadStats | null = await ts.getByRootNote(threadIri);
        if(!thread){
          return res.status(400).json({error: `no thread with threadIri ${threadIri} found`})
        }
        res.json({thread});
      }catch (err: any){
        console.error("getThreadStats error:",err);
        res.status(500).json({error:"Failed to fetch thread stats"});
      }
    },

    /**
     * GET /api/thread/:id
     * Fetch all notes belonging to a thread
     */
    async getThread(req: Request, res: Response) {
      try {
        const { id: threadId } = req.params;

        const notes = await mdb
          .collection("objects")
          .find({
            type: "Note",
            "_local.threadRoot": threadId,
          })
          .sort({ published: 1 })
          .toArray();
        
        const threadStats = await ts.getByRootNote(threadId);
        return res.json({
          threadStats,
          notes,
        });
      } catch (err) {
        console.error("getThread error:", err);
        return res.status(500).json({ error: "failed_to_fetch_thread" });
      }
    },


    /**
     * GET /api/post/:id
     * Return the logged-in user's posts (local only)
     */
    async getPost(req: Request, res: Response) {
      try {
        const {id} = req.params;
        const post = await ap.getPost(id);
        
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
        // ap.getWall(user);
        return res.json({ ok: true, items: [] });

        //stub
      } catch (err: any){
        console.error("getWall error:", err);
        res.status(500).json({ error: "Failed to fetch getWall " });
      }
    },
  };
}
