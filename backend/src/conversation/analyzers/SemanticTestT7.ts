import { Analyzer, AnalyzerContext, Observation } from "../core/types";
import { EmbeddingModel, EmbeddingRepository } from "../persistence/embeddings/types";
import { EmbeddingCollection } from "../persistence/embeddings/EmbeddingCollection";
import { collectEmbeddableSubjects } from "../persistence/embeddings/utils";
import { KMeansClusterer } from "../persistence/embeddings/clusters/KMeansClusterer";

export class SemanticTest7 implements Analyzer {
  readonly id = "semantic-test-7";
  readonly version = "1";

  readonly observationTypes = [
    "debug.embedding.cluster.0",
    "debug.embedding.cluster.1",
    "debug.embedding.cluster.2",
    "debug.embedding.cluster.3",
    "debug.embedding.cluster.4",
    "debug.embedding.cluster.5",
    "debug.embedding.cluster.6",
    "debug.embedding.cluster.7",
    "debug.embedding.cluster.8",
    "debug.embedding.cluster.9",
  ];

  readonly dependsOn = ["structural"];

  constructor(
    private readonly repository: EmbeddingRepository,
    private readonly model: EmbeddingModel,
  ) {}

  async analyze(context: AnalyzerContext): Promise<Observation[]> {
    const subjects = collectEmbeddableSubjects(context.snapshot, context.observations).filter(subject => subject.subject.type === "post");

    const collection = new EmbeddingCollection(context.snapshot, this.repository, this.model, subjects);
    await collection.initialize();

    const inputs = await Promise.all(subjects.map(async subject => ({
      id: subject.subject.id,
      vector: (await collection.getEmbedding(subject.subject.id)).values,
    })));

    const result = new KMeansClusterer(5).cluster(inputs);
    const computedAt = new Date();

    return result.clusters.map((cluster, index): Observation => ({
      subject: {
        type: "thread",
        id: context.snapshot.thread.id,
      },
      type: `debug.embedding.cluster.${index}`,
      analyzerId: this.id,
      analyzerVersion: this.version,
      data: {
        cluster: index,
        size: cluster.memberIds.length,
        posts: cluster.memberIds.map(id => ({
          id,
          text: collection.text(id),
        })),
      },
      computedAt,
    }));
  }
}