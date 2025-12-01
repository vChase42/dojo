// src/routes/postRoutes.ts

import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { postController } from "../controllers/postController";
import { AuthService } from "../services/authService";
import { UserService } from "../services/userService";
import { ActivityPubService } from "../services/activitypubService";

export function postRoutes(
  auth: AuthService,
  users: UserService,
  ap: ActivityPubService
) {
  const router = Router();
  const ctrl = postController(ap);

  // Create a new post as the logged-in user
  router.post(
    "/post",
    requireAuth(auth, users),
    ctrl.createPost
  );

  // Optional: fetch the logged-in user's outbox as plain JSON
  router.get(
    "/outbox",
    requireAuth(auth, users),
    ctrl.getMyOutbox
  );

  return router;
}
