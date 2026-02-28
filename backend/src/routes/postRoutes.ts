// src/routes/postRoutes.ts

import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { AuthService } from "../services/authService";
import { UserService } from "../services/userService";
import { ActivityPubService } from "../services/activitypubService";
import { PostsService } from "../services/postsService";
import { ThreadService } from "../services/threadService";
import { PostController } from "../controllers/postController";
import { ThreadController } from "../controllers/threadController";
import { GroupController } from "../controllers/groupController";
import { MongoService } from "../services/mongoService";
import { group } from "node:console";

export function postRoutes(
  auth: AuthService,
  users: UserService,
  ap: ActivityPubService,
  ps: PostsService,
  ts: ThreadService,
  ms: MongoService,
) {
  const router = Router();
  const replyController = PostController(ap,ps,ts);
  const threadController = ThreadController(ap,ts,ps);
  const groupController = GroupController(ap);
  /**
   * Threads
   */

  // Create a new thread
  router.post(
    "/thread",
    requireAuth(auth, users),
    threadController.createThread
  );


  /**
   * Posts
   */

  // Create a post (wall post, thread post, or reply)
  router.post(
    "/post",
    requireAuth(auth, users),
    replyController.createPost
  );


  //create a new group (the context type that threads belong to)
  router.post(
    "/group",
    requireAuth(auth, users),
    groupController.createGroup
  )



  return router;
}
