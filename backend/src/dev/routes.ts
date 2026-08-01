// src/conversation/dev/routes.ts

import { Router } from "express";

import { DevController } from "./controller";

export function createDevRoutes(controller: DevController): Router {
  const router = Router();

  router.get("/analyzers", (req, res) => controller.analyzers(req, res));
  router.get("/rankers", (req, res) => controller.rankers(req, res));
  router.get("/observation-types", (req, res) =>
    controller.observationTypes(req, res)
  );

  router.post("/thread/analysis", (req, res) => controller.analyze(req, res));
  router.get("/thread/graph", (req, res) => controller.graph(req, res));
  router.get("/thread/observations", (req, res) => controller.observations(req, res));

  return router;
}