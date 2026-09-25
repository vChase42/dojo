export type Vector = Float32Array;

function assertSameDimensions(a: Vector, b: Vector): void {
  if (a.length !== b.length) throw new Error(`Vector dimension mismatch: ${a.length} !== ${b.length}`);
}

export function add(a: Vector, b: Vector): Vector {
  assertSameDimensions(a, b);
  const result = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) result[i] = a[i] + b[i];
  return result;
}

export function subtract(a: Vector, b: Vector): Vector {
  assertSameDimensions(a, b);
  const result = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) result[i] = a[i] - b[i];
  return result;
}

export function scale(vector: Vector, scalar: number): Vector {
  const result = new Float32Array(vector.length);
  for (let i = 0; i < vector.length; i++) result[i] = vector[i] * scalar;
  return result;
}

export function dot(a: Vector, b: Vector): number {
  assertSameDimensions(a, b);
  let result = 0;
  for (let i = 0; i < a.length; i++) result += a[i] * b[i];
  return result;
}

export function magnitude(vector: Vector): number {
  return Math.sqrt(dot(vector, vector));
}

export function normalize(vector: Vector): Vector {
  const length = magnitude(vector);
  if (length === 0) throw new Error("Cannot normalize a zero vector.");
  return scale(vector, 1 / length);
}

export function cosine(a: Vector, b: Vector): number {
  const denominator = magnitude(a) * magnitude(b);
  if (denominator === 0) throw new Error("Cannot calculate cosine similarity with a zero vector.");
  return dot(a, b) / denominator;
}

export function euclideanDistance(a: Vector, b: Vector): number {
  assertSameDimensions(a, b);
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const difference = a[i] - b[i];
    sum += difference * difference;
  }
  return Math.sqrt(sum);
}

export function average(vectors: readonly Vector[]): Vector {
  if (vectors.length === 0) throw new Error("Cannot average an empty collection of vectors.");

  const dimensions = vectors[0].length;
  const result = new Float32Array(dimensions);

  for (const vector of vectors) {
    if (vector.length !== dimensions) throw new Error(`Vector dimension mismatch: ${vector.length} !== ${dimensions}`);
    for (let i = 0; i < dimensions; i++) result[i] += vector[i];
  }

  for (let i = 0; i < dimensions; i++) result[i] /= vectors.length;
  return result;
}

export const centroid = average;