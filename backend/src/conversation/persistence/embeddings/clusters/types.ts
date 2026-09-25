import { Vector } from "../vector";

export interface ClusterInput {
  id: string;
  vector: Vector;
}

export interface Cluster {
  memberIds: string[];
}

export interface ClusterResult {
  clusters: Cluster[];
  noiseIds: string[];
}

export interface Clusterer {
  cluster(inputs: readonly ClusterInput[]): ClusterResult;
}