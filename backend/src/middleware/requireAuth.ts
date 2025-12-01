// src/middleware/requireAuth.ts
import { NextFunction, Request, Response } from "express";
import { AuthService } from "../services/authService";
import { UserService } from "../services/userService";

// Extend Express Request to include authenticated user info
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      user?: any;
    }
  }
}

/**
 * requireAuth middleware:
 * - reads session cookie
 * - validates session
 * - attaches req.userId + req.user
 * - rejects if not authenticated
 */
export function requireAuth(
  authService: AuthService,
  userService: UserService
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sessionId = req.cookies?.sessionId;

      if (!sessionId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const userId = await authService.validateSession(sessionId);

      if (!userId) {
        return res.status(401).json({ error: "Invalid or expired session" });
      }

      // Load the user record
      const user = await userService.findById(userId);

      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      // Attach to request
      req.userId = userId;
      req.user = user;

      return next();
    } catch (err) {
      console.error("Auth error:", err);
      return res.status(500).json({ error: "Authentication failed" });
    }
  };
}
