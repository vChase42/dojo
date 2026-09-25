import { Analyzer, AnalyzerContext, Observation } from "../core/types";

import {
  EmbeddingModel,
  EmbeddingRepository,
} from "../persistence/embeddings/types";

import { EmbeddingCollection } from "../persistence/embeddings/EmbeddingCollection";
import { collectEmbeddableSubjects } from "../persistence/embeddings/utils";

export class SemanticPlaygroundEmbeddingAnalyzer implements Analyzer {
  readonly id = "semantic-playground";
  readonly version = "1";

  readonly observationTypes = [
    "semantic.post.embedding",
  ];

  readonly dependsOn = [
    "structural",
  ];

  constructor(
    private readonly repository: EmbeddingRepository,
    private readonly model: EmbeddingModel,
  ) {}

  async analyze(
    context: AnalyzerContext,
  ): Promise<Observation[]> {
    console.log("beginning playground.");
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
const queries = [
  "Who?",
  "How does evolution work?",
  "Can someone explain this?",
  "I don't understand.",
  "I agree.",
  "I disagree.",
  "This is a physical object.",
  "Evolution is dumb",
  "youre such a goober",
  "Romance",
  "intelligent",
  "novel",
  "fiushfdisjdkapowdaksufhsjfks",
  "the ocean floor is deep and dangerous",
];

for (const query of queries) {
  console.log();
  console.log("==================================================");
  console.log(`QUERY: ${query}`);
  console.log("==================================================");

  const results = await collection.query(query, 3);

  for (const result of results) {
    console.log("=====");
    console.log(collection.text(result.subjectId));
  }
}

    return [];
  }
}