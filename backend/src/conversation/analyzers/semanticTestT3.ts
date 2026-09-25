import { Analyzer, AnalyzerContext, Observation } from "../core/types";

import {
  EmbeddingModel,
  EmbeddingRepository,
} from "../persistence/embeddings/types";

import { EmbeddingCollection } from "../persistence/embeddings/EmbeddingCollection";
import { collectEmbeddableSubjects } from "../persistence/embeddings/utils";
import { cosine, subtract } from "../persistence/embeddings/vector";

interface TransformationTest {
  label: string;
  from: string;
  to: string;
}

const negationTests: TransformationTest[] = [
  {
    label: "dogs",
    from: "I like dogs.",
    to: "I don't like dogs.",
  },
  {
    label: "cats",
    from: "I like cats.",
    to: "I don't like cats.",
  },
  {
    label: "pizza",
    from: "I like pizza.",
    to: "I don't like pizza.",
  },
  {
    label: "music",
    from: "I like music.",
    to: "I don't like music.",
  },
];

const polarityTests: TransformationTest[] = [
  {
    label: "dogs",
    from: "I love dogs.",
    to: "I hate dogs.",
  },
  {
    label: "cats",
    from: "I love cats.",
    to: "I hate cats.",
  },
  {
    label: "pizza",
    from: "I love pizza.",
    to: "I hate pizza.",
  },
  {
    label: "music",
    from: "I love music.",
    to: "I hate music.",
  },
];

export class SemanticTest3 implements Analyzer {
  readonly id = "semantic-test-3";
  readonly version = "1";

  readonly observationTypes = [
    "debug.embedding.direction.negation",
    "debug.embedding.direction.polarity",
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

    const computedAt = new Date();

    return [
      await this.runTest(
        context,
        collection,
        "debug.embedding.direction.negation",
        negationTests,
        computedAt,
      ),
      await this.runTest(
        context,
        collection,
        "debug.embedding.direction.polarity",
        polarityTests,
        computedAt,
      ),
    ];
  }

  private async runTest(
    context: AnalyzerContext,
    collection: EmbeddingCollection,
    type: string,
    tests: TransformationTest[],
    computedAt: Date,
  ): Promise<Observation> {
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

    return {
      subject: {
        type: "thread",
        id: context.snapshot.thread.id,
      },
      type,
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
      computedAt,
    };
  }
}