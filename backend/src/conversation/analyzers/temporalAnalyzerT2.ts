// src/conversation/analyzers/temporalAnalyzerT2.ts

import { Post } from "../../types";

import {
  Analyzer,
  AnalyzerContext,
  Observation,
} from "../core/types";

import { createObserver } from "./utils";

const SESSION_GAP = 60 * 60 * 1000;
const ACTIVITY_BUCKETS = 16;

export class TemporalAnalyzerT2 implements Analyzer {
  readonly id = "temporal-t2";
  readonly version = "0.1.0";

  readonly dependsOn = [
    "temporal-t1",
  ];

  readonly observationTypes = [
    "temporal.thread.sessions",

    "temporal.session.start",
    "temporal.session.end",
    "temporal.session.duration",
    "temporal.session.posts",
    "temporal.session.participants",
    "temporal.session.interarrival-times",
    "temporal.session.activity-distribution",
  ];

  async analyze(context: AnalyzerContext): Promise<Observation[]> {
    const observations: Observation[] = [];
    const computedAt = new Date();

    const observe = createObserver({
      observations,
      analyzerId: this.id,
      analyzerVersion: this.version,
      computedAt,
    });

    const sessions = buildSessions(context.snapshot.posts);

    observeThread({
      threadId: context.snapshot.thread.id,
      sessions,
      observe,
    });

    observeSessions({
      threadId: context.snapshot.thread.id,
      sessions,
      observe,
    });

    return observations;
  }
}

interface Session {
  posts: Post[];
}


function buildSessions(posts: Post[]): Session[] {
  if (posts.length === 0) {
    return [];
  }

  const sorted = [...posts].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  );

  const sessions: Session[] = [];
  let current: Session = {
    posts: [sorted[0]],
  };

  for (let i = 1; i < sorted.length; i++) {
    const previous = sorted[i - 1];
    const post = sorted[i];

    const gap =
      post.createdAt.getTime() -
      previous.createdAt.getTime();

    if (gap > SESSION_GAP) {
      sessions.push(current);

      current = {
        posts: [],
      };
    }

    current.posts.push(post);
  }

  sessions.push(current);

  return sessions;
}

function observeThread(params: {
  threadId: string;
  sessions: Session[];
  observe: ReturnType<typeof createObserver>;
}) {
  const { threadId, sessions, observe } = params;

  observe(
    {
      type: "thread",
      id: threadId,
    },
    "temporal.thread.sessions",
    {
      threshold: SESSION_GAP,
      sessions: sessions.map(session => ({
        id: sessionId(threadId, session.posts[0].id),
      })),
    }
  );
}

function sessionId(
  threadId: string,
  firstPostId: string
): string {
  return `${threadId}::session::${firstPostId}`;
}


function observeSessions(params: {
  threadId: string;
  sessions: Session[];
  observe: ReturnType<typeof createObserver>;
}) {
  const { threadId, sessions, observe } = params;

  for (const session of sessions) {
    const id = sessionId(threadId, session.posts[0].id);

    const start = session.posts[0].createdAt;
    const end = session.posts[session.posts.length - 1]!.createdAt;

    const participants = [
      ...new Set(
        session.posts.map(post => post.authorIri)
      ),
    ];

    observe(
      {
        type: "session",
        id,
      },
      "temporal.session.start",
      {
        timestamp: start,
      }
    );

    observe(
      {
        type: "session",
        id,
      },
      "temporal.session.end",
      {
        timestamp: end,
      }
    );

    observe(
      {
        type: "session",
        id,
      },
      "temporal.session.duration",
      {
        milliseconds:
          end.getTime() - start.getTime(),
      }
    );

    observe(
      {
        type: "session",
        id,
      },
      "temporal.session.posts",
      {
        posts: session.posts.map(post => post.id),
      }
    );

    observe(
      {
        type: "session",
        id,
      },
      "temporal.session.participants",
      {
        participants,
      }
    );

    observe(
      {
        type: "session",
        id,
      },
      "temporal.session.interarrival-times",
      {
        milliseconds:
          computeInterarrivalTimes(session.posts),
      }
    );

    observe(
      {
        type: "session",
        id,
      },
      "temporal.session.activity-distribution",
      {
        bucketCount: ACTIVITY_BUCKETS,
        counts: computeActivityCurve(
          session.posts,
          ACTIVITY_BUCKETS
        ),
      }
    );
  }
}

function computeActivityCurve(
  posts: Post[],
  bucketCount: number
): number[] {
  const counts =
    Array(bucketCount).fill(0);

  if (posts.length === 0) {
    return counts;
  }

  if (posts.length === 1) {
    counts[0] = 1;
    return counts;
  }

  const start =
    posts[0].createdAt.getTime();
  const end =
    posts[posts.length - 1]!.createdAt.getTime();
  const duration =
    Math.max(1, end - start);

  for (const post of posts) {
    const position =
      (post.createdAt.getTime() - start) /
      duration;

    const bucket = Math.min(
      bucketCount - 1,
      Math.floor(position * bucketCount)
    );

    counts[bucket]++;
  }

  return counts;
}

function computeInterarrivalTimes(posts: Post[]): number[] {
  const milliseconds: number[] = [];

  for (let i = 1; i < posts.length; i++) {
    milliseconds.push(
      posts[i].createdAt.getTime() -
      posts[i - 1].createdAt.getTime()
    );
  }

  return milliseconds;
}