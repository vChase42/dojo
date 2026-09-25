import { Analyzer, AnalyzerContext, Observation } from "../core/types";

import {
  EmbeddingModel,
  EmbeddingRepository,
} from "../persistence/embeddings/types";

import { EmbeddingCollection } from "../persistence/embeddings/EmbeddingCollection";
import { collectEmbeddableSubjects } from "../persistence/embeddings/utils";
import { add, cosine, subtract } from "../persistence/embeddings/vector";

interface TransformationTest {
  type: string;
  sourceFrom: string;
  sourceTo: string;
  target: string;
  expected: string;
  candidates: string[];
}

const tests: TransformationTest[] = [
  {
    type: "debug.embedding.transplant.negation",
    sourceFrom: "I like dogs.",
    sourceTo: "I don't like dogs.",
    target: "I like bananas.",
    expected: "I don't like bananas.",
    candidates: [
      "I like bananas.",
      "I don't like bananas.",
      "I love bananas.",
      "I hate bananas.",
      "I eat bananas.",
      "I don't eat bananas.",
      "Bananas are yellow.",
      "I like apples.",
    ],
  },
  {
    type: "debug.embedding.transplant.polarity",
    sourceFrom: "I love dogs.",
    sourceTo: "I hate dogs.",
    target: "I love bananas.",
    expected: "I hate bananas.",
    candidates: [
      "I love bananas.",
      "I hate bananas.",
      "I like bananas.",
      "I don't like bananas.",
      "I eat bananas.",
      "I don't eat bananas.",
      "Bananas are yellow.",
      "I love apples.",
    ],
  },
];

export class SemanticTest4 implements Analyzer {
  readonly id = "semantic-test-4";
  readonly version = "1";

  readonly observationTypes = tests.map(test => test.type);

  readonly dependsOn = [
    "structural",
  ];

  constructor(
    private readonly repository: EmbeddingRepository,
    private readonly model: EmbeddingModel,
  ) {}

  async analyze(context: AnalyzerContext): Promise<Observation[]> {
    const subjects = collectEmbeddableSubjects(
      context.snapshot,
      context.observations,
    ).filter(subject => subject.subject.type === "post");

    const collection = new EmbeddingCollection(
      context.snapshot,
      this.repository,
      this.model,
      subjects,
    );

    await collection.initialize();

    const computedAt = new Date();
    const observations: Observation[] = [];

    for (const test of tests) {
      const sourceFrom = await collection.vector(test.sourceFrom);
      const sourceTo = await collection.vector(test.sourceTo);
      const target = await collection.vector(test.target);

      const direction = subtract(sourceTo, sourceFrom);
      const transformed = add(target, direction);

      const candidates = [];

      for (const text of test.candidates) {
        const vector = await collection.vector(text);

        candidates.push({
          text,
          cosine: cosine(transformed, vector),
          targetCosine: cosine(target, vector),
        });
      }

      candidates.sort((a, b) => b.cosine - a.cosine);

      observations.push({
        subject: {
          type: "thread",
          id: context.snapshot.thread.id,
        },
        type: test.type,
        analyzerId: this.id,
        analyzerVersion: this.version,
        data: {
          modelId: this.model.id,
          modelVersion: this.model.version,
          dimensions: this.model.dimensions,
          transformation: {
            from: test.sourceFrom,
            to: test.sourceTo,
          },
          target: test.target,
          expected: test.expected,
          candidates,
        },
        computedAt,
      });
    }

    return observations;
  }
}