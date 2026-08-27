// src/conversation/persistence/embeddings/models/SentenceTransformerModel.ts

import { FeatureExtractionPipeline, pipeline } from "@huggingface/transformers";

import { EmbeddingModel } from "../types";

export class SentenceTransformerModel implements EmbeddingModel {
  readonly id: string;

  get version(): string {
    return this.getConfig().transformers_version ?? "unknown";
  }

  get dimensions(): number {
    return this.getConfig().hidden_size;
  }

  private pipeline?: FeatureExtractionPipeline;

  constructor(id: string) {
    this.id = id;
  }

  async initialize(): Promise<void> {
    if (this.pipeline) {
      return;
    }

    this.pipeline = await pipeline(
      "feature-extraction",
      this.id,
      {
        device: "cuda",
      }
    );
  }

  async embed(text: string): Promise<Float32Array> {
    return (await this.embedMany([text]))[0];
  }

  async embedMany(texts: string[]): Promise<Float32Array[]> {
    if (texts.length === 0) {
      return [];
    }

    const pipe = this.getPipeline();

    const tensor = await pipe(texts, {
      pooling: "mean",
      normalize: true,
    });

    if (tensor.type !== "float32") {
      throw new Error(`Expected float32 embeddings, got ${tensor.type}.`);
    }

    const data = tensor.data as Float32Array;
    const [count, dimensions] = tensor.dims;

    const embeddings: Float32Array[] = [];

    for (let i = 0; i < count; i++) {
      embeddings.push(
        data.slice(
          i * dimensions,
          (i + 1) * dimensions
        )
      );
    }

    return embeddings;
  }

  async dispose(): Promise<void> {
    // TODO: Transformers.js currently doesn't expose explicit disposal.
    this.pipeline = undefined;
  }

  private getPipeline(): FeatureExtractionPipeline {
    if (!this.pipeline) {
      throw new Error("Model has not been initialized.");
    }

    return this.pipeline;
  }

  private getConfig(): any {
    return this.getPipeline().model.config as any;
  }
}