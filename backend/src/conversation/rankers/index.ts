// src/conversation/rankers/index.ts

import { Ranker } from "../core/types";

export const rankers: Ranker[] = [];

export const rankerMap = new Map(
  rankers.map(ranker => [ranker.id, ranker])
);