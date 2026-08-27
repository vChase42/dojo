import { Analyzer, AnalyzerContext, Observation } from "../core/types";

import {
  EmbeddingModel,
  EmbeddingRepository,
} from "../persistence/embeddings/types";

import { EmbeddingCollection } from "../persistence/embeddings/EmbeddingCollection";
import { collectEmbeddableSubjects } from "../persistence/embeddings/utils";

export class SemanticPostEmbeddingAnalyzer implements Analyzer {
  readonly id = "semantic";
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

    console.log();
    console.log("============================================================");
    console.log("POST EMBEDDINGS");
    console.log("============================================================");

    for (const subject of subjects) {
      const neighbors = await collection.nearest(subject.subject.id, 5);

      console.log();
      console.log("------------------------------------------------------------");
      console.log(collection.text(subject.subject.id));

      for (const neighbor of neighbors) {
        if (neighbor.subjectId === subject.subject.id) {
          continue;
        }

        console.log();
        console.log("> --------------------------------");
        console.log(collection.text(neighbor.subjectId));
      }
    }

    console.log();
    console.log("============================================================");
    console.log('QUERY: "people asking questions"');
    console.log("============================================================");

    for (const neighbor of await collection.query("people asking questions", 10)) {
      console.log();
      console.log(collection.text(neighbor.subjectId));
    }

    return [];
  }
}