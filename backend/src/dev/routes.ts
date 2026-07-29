// src/conversation/dev/routes.ts

import { Router } from "express";

import { DevController } from "./controller";

export function createDevRoutes(controller: DevController): Router {
    const router = Router();

    router.get("/thread/:threadId/graph", (req, res) =>
        controller.graph(req, res)
    );

    router.post("/analyze", (req, res) => controller.analyze(req, res));

    return router;
}