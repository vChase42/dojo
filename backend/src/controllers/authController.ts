// src/controllers/authController.ts

import { Request, Response } from "express";
import { AuthService } from "../services/authService";
import { UserService } from "../services/userService";

const isProd = process.env.NODE_ENV === "production";

export function authController(
  authService: AuthService,
  userService: UserService
) {
  return {
    /** POST /api/signup */
    signup: async (req: Request, res: Response) => {
      try {
        const { username, password } = req.body;

        if (!username || !password) {
          return res
            .status(400)
            .json({ error: "username and password required" });
        }

        // Create ActivityPub actor externally
        // (your logic will call apex.createActor here)
        const actorId = `https://localhost/u/${username}`;

        const user = await userService.createUser(username, password, actorId);

        return res.status(201).json({ ok: true, user });
      } catch (err: any) {
        console.error("Signup error:", err);
        return res.status(500).json({ error: err.message || "Signup failed" });
      }
    },

    /** POST /api/login */
    login: async (req: Request, res: Response) => {
      try {

        const { username, password } = req.body;

        if (!username || !password) {
          return res
            .status(400)
            .json({ error: "username and password required" });
        }

        const user = await userService.findByUsername(username);
        if (!user) {
          return res.status(401).json({ error: "Invalid credentials" });
        }

        const valid = await userService.verifyPassword(user, password);
        if (!valid) {
          return res.status(401).json({ error: "Invalid credentials" });
        }

        // Create session
        const sessionId = await authService.createSession(user._id!.toString());

        // Set HttpOnly cookie
        res.cookie("sessionId", sessionId, {
          httpOnly: false,
          secure: true, 
          sameSite: "none",
          path: "/",
          maxAge: 1000 * 60 * 60 * 24, // 1 day
        });
        

        return res.json({ ok: true, user: { username: user.username } });
      } catch (err: any) {
        console.error("Login error:", err);
        return res.status(500).json({ error: err.message || "Login failed" });
      }
    },

    /** POST /api/logout */
    logout: async (req: Request, res: Response) => {
      try {
        const sessionId = req.cookies?.sessionId;
        if (sessionId) {
          await authService.deleteSession(sessionId);
        }

        // Delete cookie
        res.clearCookie("sessionId", {
          httpOnly: true,
          secure: isProd,
          sameSite: "lax",
          path: "/",
        });

        return res.json({ ok: true });
      } catch (err: any) {
        console.error("Logout error:", err);
        return res.status(500).json({ error: "Logout failed" });
      }
    },
    // inside authController

    me: async (req: Request, res: Response) => {
      // requireAuth already sets req.user
      res.json({ username: req.user.username });
    },

  };
}
