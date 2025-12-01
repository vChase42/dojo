// src/routes/authRoutes.ts

import { Router } from "express";
import { authController } from "../controllers/authController";
import { AuthService } from "../services/authService";
import { UserService } from "../services/userService";

export function authRoutes(
  authService: AuthService,
  userService: UserService
) {
  const router = Router();
  const ctrl = authController(authService, userService);

  // Create account
  router.post("/signup", ctrl.signup);

  // Log in
  router.post("/login", ctrl.login);

  // Log out
  router.post("/logout", ctrl.logout);

  return router;
}
