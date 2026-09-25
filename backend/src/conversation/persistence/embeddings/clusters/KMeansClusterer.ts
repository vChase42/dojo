import { kmeans } from "ml-kmeans";
import { Cluster, Clusterer, ClusterInput, ClusterResult } from "./types";

export class KMeansClusterer implements Clusterer {
  constructor(private readonly k: number) {
    if (k < 1) throw new Error("k must be at least 1.");
  }

  cluster(inputs: readonly ClusterInput[]): ClusterResult {
    if (inputs.length === 0) return { clusters: [], noiseIds: [] };
    if (this.k > inputs.length) throw new Error(`k (${this.k}) cannot exceed input count (${inputs.length}).`);

  const result = kmeans(inputs.map(input => Array.from(input.vector)), this.k, {});
    const clusters: Cluster[] = Array.from({ length: this.k }, () => ({ memberIds: [] }));

    for (let i = 0; i < inputs.length; i++) {
      clusters[result.clusters[i]].memberIds.push(inputs[i].id);
    }

    return {
      clusters,
      noiseIds: [],
    };
  }
}