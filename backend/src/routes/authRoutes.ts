// src/routes/authRoutes.ts

import { Router } from "express";
import { authController } from "../controllers/authController";
import { AuthService } from "../services/authService";
import { UserService } from "../services/userService";
import { requireAuth } from "../middleware/requireAuth";
import { ActivityPubService } from "../services/activitypubService";

export function authRoutes(
  authService: AuthService,
  userService: UserService,
  activityPubService: ActivityPubService
) {
  const router = Router();
  const ctrl = authController(authService, userService, activityPubService);

  //
  // Public auth endpoints
  //

  // Create account
  router.post("/signup", ctrl.signup);

  // Log in
  router.post("/login", ctrl.login);

  //
  // Protected auth endpoints
  //

  // Return currently authenticated user
  router.get("/me", requireAuth(authService, userService), ctrl.me);

  // Log out
  router.post("/logout", requireAuth(authService, userService), ctrl.logout);

  return router;
}
