// src/conversation/analyzers/index.ts

import { Analyzer } from "../core/types";

import { StructuralAnalyzer } from "./structuralAnalyzer";
import { ParticipationAnalyzer } from "./participationAnalyzer";

export const analyzers: Analyzer[] = [
  new StructuralAnalyzer(),
  new ParticipationAnalyzer(),
];

export const analyzerMap = new Map(
  analyzers.map(analyzer => [analyzer.id, analyzer])
);