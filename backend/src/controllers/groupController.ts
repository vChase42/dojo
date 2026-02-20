// src/controllers/groupController.ts

import { Request, Response } from "express";
import { ActivityPubService } from "../services/activitypubService";

export function GroupController(ap: ActivityPubService) {
  return {
    /**
     * POST /api/group
     * Create a new group
     */
    async createGroup(req: Request, res: Response) {
      try {
        const { groupName, summary } = req.body;

        if (!groupName || typeof groupName !== "string") {
          return res.status(400).json({ error: "groupName is required" });
        }

        if (summary && typeof summary !== "string") {
          return res.status(400).json({ error: "summary must be a string" });
        }

        const groupId = await ap.createGroup(groupName, {
          summary,
          discoverable: true,
        });

        return res.status(201).json({
          ok: true,
          groupId,
        });
      } catch (err: any) {
        console.error("createGroup error:", err);
        return res
          .status(500)
          .json({ error: err.message || "Failed to create group" });
      }
    },
  };
}
