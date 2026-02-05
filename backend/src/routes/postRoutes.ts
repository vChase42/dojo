// src/routes/postRoutes.ts

import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { postController } from "../controllers/postController";
import { AuthService } from "../services/authService";
import { UserService } from "../services/userService";
import { ActivityPubService } from "../services/activitypubService";
import { NoteStatsService } from "../services/NoteStatsService";
import { ThreadStatsService } from "../services/ThreadStatsService";

export function postRoutes(
  auth: AuthService,
  users: UserService,
  ap: ActivityPubService,
  ns: NoteStatsService,
  ts: ThreadStatsService,
) {
  const router = Router();
  const ctrl = postController(ap, ns, ts);

  /**
   * Threads
   */

  // Create a new thread
  router.post(
    "/thread",
    requireAuth(auth, users),
    ctrl.createThread
  );

  // List all threads (local, forum index)
  router.get(
    "/threads",
    ctrl.getThreads
  );

  // Get a single thread by id
  router.get(
    "/thread/:id",
    ctrl.getThread
  );

  router.get(
    "/post/:id",
    ctrl.getPost
  );

  /**
   * Posts
   */

  // Create a post (wall post, thread post, or reply)
  router.post(
    "/post",
    requireAuth(auth, users),
    ctrl.createPost
  );



  return router;
}
