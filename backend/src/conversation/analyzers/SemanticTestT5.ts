import { Analyzer, AnalyzerContext, Observation } from "../core/types";

import {
  EmbeddingModel,
  EmbeddingRepository,
} from "../persistence/embeddings/types";

import { EmbeddingCollection } from "../persistence/embeddings/EmbeddingCollection";
import { collectEmbeddableSubjects } from "../persistence/embeddings/utils";
import { cosine, subtract } from "../persistence/embeddings/vector";

interface NegationTest {
  label: string;
  from: string;
  to: string;
}

const tests: NegationTest[] = [
  {
    label: "preference",
    from: "I like dogs.",
    to: "I don't like dogs.",
  },
  {
    label: "possession",
    from: "She owns a car.",
    to: "She doesn't own a car.",
  },
  {
    label: "past-action",
    from: "They went home.",
    to: "They didn't go home.",
  },
  {
    label: "correctness",
    from: "This is correct.",
    to: "This is not correct.",
  },
  {
    label: "state",
    from: "The door is open.",
    to: "The door is not open.",
  },
  {
    label: "ability",
    from: "He can swim.",
    to: "He cannot swim.",
  },
];

export class SemanticTest5 implements Analyzer {
  readonly id = "semantic-test-5";
  readonly version = "1";

  readonly observationTypes = [
    "debug.embedding.direction.cross-template-negation",
  ];

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

    const transformations = [];

    for (const test of tests) {
      const from = await collection.vector(test.from);
      const to = await collection.vector(test.to);

      transformations.push({
        ...test,
        similarity: cosine(from, to),
        direction: subtract(to, from),
      });
    }

    const comparisons = [];

    for (let i = 0; i < transformations.length; i++) {
      for (let j = i + 1; j < transformations.length; j++) {
        comparisons.push({
          a: transformations[i].label,
          b: transformations[j].label,
          cosine: cosine(
            transformations[i].direction,
            transformations[j].direction,
          ),
        });
      }
    }

    return [
      {
        subject: {
          type: "thread",
          id: context.snapshot.thread.id,
        },
        type: "debug.embedding.direction.cross-template-negation",
        analyzerId: this.id,
        analyzerVersion: this.version,
        data: {
          modelId: this.model.id,
          modelVersion: this.model.version,
          dimensions: this.model.dimensions,
          transformations: transformations.map(transformation => ({
            label: transformation.label,
            from: transformation.from,
            to: transformation.to,
            cosine: transformation.similarity,
            distance: 1 - transformation.similarity,
          })),
          directionComparisons: comparisons,
        },
        computedAt: new Date(),
      },
    ];
  }
}