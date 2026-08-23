// src/conversation/analyzers/index.ts

import { Analyzer } from "../core/types";

import { StructuralAnalyzer } from "./structuralAnalyzer";
import { ParticipationAnalyzer } from "./participationAnalyzer";
import { TemporalAnalyzerT1 } from "./temporalAnalyzerT1";
import { TemporalAnalyzerT2 } from "./temporalAnalyzerT2";

export const analyzers: Analyzer[] = [
  new StructuralAnalyzer(),
  new ParticipationAnalyzer(),
  new TemporalAnalyzerT1(),
  new TemporalAnalyzerT2(),
];

export const analyzerMap = new Map(
  analyzers.map(analyzer => [analyzer.id, analyzer])
);