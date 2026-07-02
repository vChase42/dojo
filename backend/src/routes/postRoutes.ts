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
import { ForumService } from "../services/forumService";

export function postRoutes(
  auth: AuthService,
  users: UserService,
  ap: ActivityPubService,
  ps: PostsService,
  ts: ThreadService,
  fs: ForumService,
) {
  const router = Router();
  const postController = PostController(fs,ps,ts);
  const threadController = ThreadController(fs,ts);
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
    postController.createPost
  );


  //create a new group (the context type that threads belong to)
  router.post(
    "/group",
    requireAuth(auth, users),
    groupController.createGroup
  )
  router.post(
    "/deletepost",
    requireAuth(auth, users),
    postController.deletePost
  );
  router.post(
    "/votepost",
    requireAuth(auth, users),
    postController.votePost
  );
  router.post(
    "/editpost",
    requireAuth(auth,users),
    postController.editPost
  );

  return router;
}
