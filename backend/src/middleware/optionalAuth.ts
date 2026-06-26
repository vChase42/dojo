// src/middleware/optionalAuth.ts

import { NextFunction, Request, Response } from "express";
import { AuthService } from "../services/authService";
import { UserService } from "../services/userService";

export function optionalAuth(
  authService: AuthService,
  userService: UserService
) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const sessionId = req.cookies?.sessionId;

      if (!sessionId) {
        return next();
      }

      const userId = await authService.validateSession(sessionId);

      if (!userId) {
        return next();
      }

      const user = await userService.findById(userId);

      if (!user) {
        return next();
      }

      req.userId = userId;
      req.user = user;

      return next();
    } catch (err) {
      console.error("Optional auth error:", err);
      return next();
    }
  };
}