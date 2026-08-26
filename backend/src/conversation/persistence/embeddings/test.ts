// src/conversation/persistence/embeddings/test.ts

import { pipeline } from "@huggingface/transformers";
import { env } from "@huggingface/transformers";

console.dir(env.backends.onnx, { depth: 3 });


async function benchmark(name: string, fn: () => Promise<void>) {
  console.time(name);
  await fn();
  console.timeEnd(name);
}

async function main() {
  console.time("load");

const extractor = await pipeline(
  "feature-extraction",
  "sentence-transformers/all-MiniLM-L6-v2",
  {
    device: "cuda",
  }
);

  console.timeEnd("load");

const config = extractor.model.config as any;

console.log("\n=== MODEL ===");
console.log({
  hiddenSize: config.hidden_size,
  maxSequenceLength: extractor.tokenizer.config.model_max_length,
  name: config._name_or_path,
});

  console.log("\n=== EXECUTION PROVIDER ===");
  console.dir(extractor.model.sessions.model, { depth: 3 });

  const small = [
    "Hello world!",
    "The quick brown fox jumps over the lazy dog.",
    "Embeddings are pretty neat.",
  ];

  await benchmark("embed (3)", async () => {
    const output = await extractor(small, {
      pooling: "mean",
      normalize: true,
    });

    const data = output.data as Float32Array;

    console.log({
      dims: output.dims,
      size: output.size,
      type: output.type,
      dataLength: output.data.length,
      firstVectorNorm: vectorNorm(data.slice(0, output.dims[1])),
    });
  });

  const medium = Array.from(
    { length: 300 },
    (_, i) => `This is benchmark sentence number ${i}.`
  );

  await benchmark("embed (300)", async () => {
    const output = await extractor(medium, {
      pooling: "mean",
      normalize: true,
    });

    console.log({
      dims: output.dims,
      size: output.size,
      type: output.type,
    });
  });

  const identical = [
    "hello world",
    "hello world",
    "hello world",
  ];

  const identicalOutput = await extractor(identical, {
    pooling: "mean",
    normalize: true,
  });
console.log("\n=== DETERMINISM ===");

const dims = identicalOutput.dims[1];
const data = identicalOutput.data as Float32Array;

const a = data.slice(0, dims);
const b = data.slice(dims, dims * 2);
const c = data.slice(dims * 2);

  console.log({
    aEqualsB: arraysEqual(a, b),
    bEqualsC: arraysEqual(b, c),
  });

  console.log("\n=== NORMALIZATION ===");
  console.log({
    normA: vectorNorm(a),
    normB: vectorNorm(b),
    normC: vectorNorm(c),
  });

  console.log("\n=== COSINE ===");
  console.log({
    identical: dot(a, b),
  });


  console.log("Done.");

process.exit(0);
}

function vectorNorm(v: ArrayLike<number>) {
  let sum = 0;

  for (let i = 0; i < v.length; i++) {
    sum += v[i] * v[i];
  }

  return Math.sqrt(sum);
}

function dot(a: ArrayLike<number>, b: ArrayLike<number>) {
  let sum = 0;

  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }

  return sum;
}

function arraysEqual(a: ArrayLike<number>, b: ArrayLike<number>) {
  if (a.length !== b.length) {
    return false;
  }

  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }

  return true;
}

main().catch(console.error);


function floatData(tensor: { type: string; data: unknown }) {
  if (tensor.type !== "float32") {
    throw new Error(`Expected float32 tensor, got ${tensor.type}.`);
  }

  return tensor.data as Float32Array;
}