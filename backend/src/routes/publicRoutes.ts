// src/routes/publicRoutes.ts

import { Router } from "express";
import { ThreadController } from "../controllers/threadController";
import { MongoService } from "../services/mongoService";
import { ActivityPubService } from "../services/activitypubService";
import { ThreadStatsService } from "../services/ThreadStatsService";

export function publicRoutes(ap: ActivityPubService, ms: MongoService, ts: ThreadStatsService) {
  const router = Router();
  const threadController = ThreadController(ap, ts, ms);

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
    "/thread/:id",
    threadController.getThreadConversation
  );

  return router;
}
