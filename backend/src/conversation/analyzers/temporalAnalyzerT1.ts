// src/conversation/analyzers/temporalAnalyzerT1.ts

import { Post } from "../../types";
import {
  Analyzer,
  AnalyzerContext,
  Observation,
} from "../core/types";

import { createObserver } from "./utils";

const ACTIVITY_BUCKETS = 32;

export class TemporalAnalyzerT1 implements Analyzer {
  readonly id = "temporal-t1";
  readonly version = "0.1.0";

  readonly dependsOn = [
    "structural",
  ];

  readonly observationTypes = [
    "temporal.thread.start",
    "temporal.thread.end",
    "temporal.thread.lifetime",
    "temporal.thread.interarrival-times",

    "temporal.post.sequence",
    "temporal.post.age",
    "temporal.post.parent-delay",

    "temporal.branch.duration",
    "temporal.branch.interarrival-times",
  ];

  async analyze(
    context: AnalyzerContext
  ): Promise<Observation[]> {
    const { snapshot } = context;

    const observations: Observation[] = [];
    const computedAt = new Date();

    const observe = createObserver({
      observations,
      analyzerId: this.id,
      analyzerVersion: this.version,
      computedAt,
    });

    const posts = [...snapshot.posts].sort(
      (a, b) =>
        a.createdAt.getTime() -
        b.createdAt.getTime()
    );

    if (posts.length === 0) {
      return observations;
    }

    observeThread({
      posts,
      observe,
    });

    observePosts({
      posts,
      snapshot,
      observe,
    });

    const structural =
      context.observations.get("structural") ?? [];

    observeBranches({
      structural,
      snapshot,
      observe,
    });

    return observations;
  }
}

function observeThread(params: {
  posts: Post[];
  observe: ReturnType<typeof createObserver>;
}) {
  const { posts, observe } = params;

  const threadId = posts[0].threadId;
  const start = posts[0].createdAt;
  const end = posts[posts.length - 1]!.createdAt;

  observe({ type: "thread", id: threadId }, "temporal.thread.start", { timestamp: start });
  observe({ type: "thread", id: threadId }, "temporal.thread.end", { timestamp: end });
  observe({ type: "thread", id: threadId }, "temporal.thread.lifetime", { milliseconds: end.getTime() - start.getTime() });
  observe({ type: "thread", id: threadId }, "temporal.thread.interarrival-times", { milliseconds: computeInterarrivalTimes(posts) });
}

function observePosts(params: {
  posts: Post[];
  snapshot: AnalyzerContext["snapshot"];
  observe: ReturnType<typeof createObserver>;
}) {
  const { posts, snapshot, observe } = params;
  const start = posts[0].createdAt.getTime();

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];

    observe({ type: "post", id: post.id }, "temporal.post.sequence", { index: i });
    observe({ type: "post", id: post.id }, "temporal.post.age", { milliseconds: post.createdAt.getTime() - start });

    const parent = post.parentId ? snapshot.postsById.get(post.parentId) : undefined;
    const delay = parent ? post.createdAt.getTime() - parent.createdAt.getTime() : 0;

    observe({ type: "post", id: post.id }, "temporal.post.parent-delay", { milliseconds: delay });
  }
}


function observeBranches(params: {
  structural: Observation[];
  snapshot: AnalyzerContext["snapshot"];
  observe: ReturnType<typeof createObserver>;
}) {
  const { structural, snapshot, observe } = params;

  const branches = structural.filter(
    observation => observation.type === "structure.branch.posts"
  );

  for (const branch of branches) {
    const postIds = (branch.data.posts as string[]) ?? [];

    const posts = postIds
      .map(id => snapshot.postsById.get(id))
      .filter((post): post is Post => post !== undefined)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    if (posts.length === 0) {
      continue;
    }

    const start = posts[0].createdAt;
    const end = posts[posts.length - 1]!.createdAt;

    observe(branch.subject, "temporal.branch.duration", {
      milliseconds: end.getTime() - start.getTime(),
    });

    observe(branch.subject, "temporal.branch.interarrival-times", {
      milliseconds: computeInterarrivalTimes(posts),
    });
  }
}

function computeInterarrivalTimes(
  posts: {
    createdAt: Date;
  }[]
): number[] {
  const result: number[] = [];

  for (let i = 1; i < posts.length; i++) {
    result.push(
      posts[i].createdAt.getTime() -
      posts[i - 1].createdAt.getTime()
    );
  }

  return result;
}

function computeActivityCurve(
  posts: {
    createdAt: Date;
  }[],
  bucketCount: number
): number[] {
  const counts =
    Array(bucketCount).fill(0);

  if (posts.length === 0) {
    return counts;
  }

  const start =
    posts[0].createdAt.getTime();
  const end =
    posts[posts.length - 1]!.createdAt.getTime();
  const duration =
    Math.max(1, end - start);

  for (const post of posts) {
    const normalized =
      (post.createdAt.getTime() - start) /
      duration;

    const bucket = Math.min(
      bucketCount - 1,
      Math.floor(
        normalized * bucketCount
      )
    );

    counts[bucket]++;
  }

  return counts;
}