import { randomUUID } from "crypto";

import { ThreadSnapshot } from "../../core/types";

import {
  Embedding,
  EmbeddingFilter,
  EmbeddingModel,
  EmbeddingRepository,
} from "./types";

import {
  EmbeddableSubject,
  serializePosts,
} from "./utils";

export class EmbeddingCollection {
  private initialized = false;

  constructor(
    private readonly snapshot: ThreadSnapshot,
    private readonly repository: EmbeddingRepository,
    private readonly model: EmbeddingModel,
    private readonly subjects: EmbeddableSubject[],
  ) {}

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const filter = this.createFilter();

    const existing = await this.repository.query(filter);

    const existingIds = new Set(
      existing.map(embedding => embedding.subjectId),
    );

    const missingSubjects = this.subjects.filter(
      subject => !existingIds.has(subject.subject.id),
    );

    if (missingSubjects.length > 0) {
      const texts = missingSubjects.map(subject =>
        serializePosts(this.snapshot, subject.postIds),
      );

      const vectors = await this.model.embedMany(texts);

      const createdAt = new Date();

      const embeddings: Embedding[] = missingSubjects.map((subject, index) => ({
        threadId: this.snapshot.thread.id,
        subjectType: subject.subject.type,
        subjectId: subject.subject.id,
        modelId: this.model.id,
        modelVersion: this.model.version,
        values: vectors[index],
        createdAt,
      }));

      await this.repository.saveMany(embeddings);
    }

    this.initialized = true;
  }

  async getEmbedding(subjectId: string): Promise<Embedding> {
    await this.initialize();

    const [embedding] = await this.repository.query({
      subjectIds: [subjectId],
      modelId: this.model.id,
      modelVersion: this.model.version,
    });

    if (!embedding) {
      throw new Error(`Embedding not found for subject "${subjectId}".`);
    }

    return embedding;
  }

  async similarity(a: string, b: string): Promise<number> {
    throw new Error("Not implemented.");
  }

  async similarityToText(subjectId: string, text: string): Promise<number> {
    throw new Error("Not implemented.");
  }

  async nearest(subjectId: string, limit = 10): Promise<Embedding[]> {
    const embedding = await this.getEmbedding(subjectId);

    return this.repository.nearest({
      filter: this.createFilter(),
      embedding: embedding.values,
      limit,
    });
  }

  async query(text: string, limit = 10): Promise<Embedding[]> {
    await this.initialize();

    const embedding = await this.model.embed(text);

    return this.repository.nearest({
      filter: this.createFilter(),
      embedding,
      limit,
    });
  }

  async embedText(text: string): Promise<string> {
    const subjectId = randomUUID();

    const embedding: Embedding = {
      threadId: this.snapshot.thread.id,
      subjectType: "temporary",
      subjectId,
      modelId: this.model.id,
      modelVersion: this.model.version,
      values: await this.model.embed(text),
      createdAt: new Date(),
    };

    await this.repository.save(embedding);

    this.subjects.push({
      subject: {
        type: "temporary",
        id: subjectId,
      },
      postIds: [],
    });

    return subjectId;
  }

  private createFilter(): EmbeddingFilter {
    return {
      subjectIds: this.subjects.map(subject => subject.subject.id),
      modelId: this.model.id,
      modelVersion: this.model.version,
    };
  }


  subject(subjectId: string): EmbeddableSubject {
    const subject = this.subjects.find(subject => subject.subject.id === subjectId);

    if (!subject) {
      throw new Error(`Unknown subject "${subjectId}".`);
    }

    return subject;
  }

  text(subjectId: string): string {
    return serializePosts(
      this.snapshot,
      this.subject(subjectId).postIds,
    );
  }
}