import { Analyzer, AnalyzerContext, Observation } from "../core/types";

import {
  EmbeddingModel,
  EmbeddingRepository,
} from "../persistence/embeddings/types";

import { EmbeddingCollection } from "../persistence/embeddings/EmbeddingCollection";
import { collectEmbeddableSubjects } from "../persistence/embeddings/utils";
import { cosine } from "../persistence/embeddings/vector";

interface SimilarityTest {
  type: string;
  a: string;
  b: string;
}

const tests: SimilarityTest[] = [
  {
    type: "debug.embedding.similarity.synonymy",
    a: "I am happy.",
    b: "I am joyful.",
  },
  {
    type: "debug.embedding.similarity.antonymy",
    a: "I am happy.",
    b: "I am sad.",
  },
  {
    type: "debug.embedding.similarity.negation",
    a: "I like dogs.",
    b: "I don't like dogs.",
  },
  {
    type: "debug.embedding.similarity.intensity",
    a: "I like this.",
    b: "I love this.",
  },
  {
    type: "debug.embedding.similarity.topic-opposition",
    a: "I love dogs.",
    b: "I hate dogs.",
  },
  {
    type: "debug.embedding.similarity.paraphrase",
    a: "Where is the bathroom?",
    b: "Can you tell me where the restroom is?",
  },
  {
    type: "debug.embedding.similarity.entailment",
    a: "The dog is running.",
    b: "An animal is moving.",
  },
  {
    type: "debug.embedding.similarity.unrelated",
    a: "The dog is running.",
    b: "PostgreSQL supports transactions.",
  },
  {
    type: "debug.embedding.similarity.agreement-opposition",
    a: "I agree with you.",
    b: "I disagree with you.",
  },
  {
    type: "debug.embedding.similarity.agreement-paraphrase",
    a: "I agree with you.",
    b: "I think you're right.",
  },
];

export class SemanticSimilarityEmbeddingAnalyzer implements Analyzer {
  readonly id = "semantic-similarity";
  readonly version = "3";

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
      const a = await collection.vector(test.a);
      const b = await collection.vector(test.b);

      observations.push({
        subject: {
          type: "thread",
          id: context.snapshot.thread.id,
        },
        type: test.type,
        analyzerId: this.id,
        analyzerVersion: this.version,
        data: {
          a: test.a,
          b: test.b,
          cosine: cosine(a, b),
          modelId: this.model.id,
          modelVersion: this.model.version,
          dimensions: this.model.dimensions,
        },
        computedAt,
      });
    }

    return observations;
  }
}