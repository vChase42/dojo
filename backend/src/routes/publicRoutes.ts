// src/routes/publicRoutes.ts

import { Router } from "express";
import { ThreadController } from "../controllers/threadController";
import { PostsService } from "../services/postsService";
import { ActivityPubService } from "../services/activitypubService";
import { ThreadService } from "../services/threadService";
import { PostController } from "../controllers/postController";
import { optionalAuth } from "../middleware/optionalAuth";
import { UserService } from "../services/userService";
import { AuthService } from "../services/authService";

export function publicRoutes(auth: AuthService, users: UserService ,ap: ActivityPubService, ps: PostsService, ts: ThreadService) {
  const router = Router();
  const threadController = ThreadController(ap, ts, ps);
  const postController = PostController(ap,ps,ts);

  // List all threads (local, forum index)
  router.get(
    "/threads",
    threadController.getThreads
  );

  // get stats for a thread.
  router.get(
    "/threadstats",
    threadController.getThreadStats
  )

  // Get a thread stats and list of all the relevant notes.
  router.get(
    "/thread/:threadId",
    optionalAuth(auth,users),
    postController.getThreadPosts
  );

  return router;
}
