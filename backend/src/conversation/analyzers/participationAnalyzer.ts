import { Post } from "../../types";
import {
  Analyzer,
  AnalyzerContext,
  Observation,
} from "../core/types";

import { createObserver } from "./utils";

export class ParticipationAnalyzer implements Analyzer {
  readonly id = "participation";
  readonly version = "0.1.0";
  readonly dependsOn = ["structural"];

  readonly observationTypes = [
    // Participant
    "participation.participant.posts",
    "participation.participant.post-share",
    "participation.participant.sent-replies",
    "participation.participant.received-replies",
    "participation.participant.unique-recipients",
    "participation.participant.unique-responders",
    "participation.participant.branches-participated",
    "participation.participant.first-post",
    "participation.participant.last-post",
    "participation.participant.active-duration",
    "participation.participant.average-depth",
    "participation.participant.average-response-time",
    "participation.participant.response-latency",
    "participation.participant.initiated-branches",
    "participation.participant.join-order",

    // Thread
    "participation.thread.concentration",
    "participation.thread.gini",
    "participation.thread.newcomers",
    "participation.thread.returning",
  ];

  async analyze(context: AnalyzerContext): Promise<Observation[]> {

    const { snapshot, observations: analyzerObservations } = context;

    const observations: Observation[] = [];
    const computedAt = new Date();

    const observe = createObserver({
      observations,
      analyzerId: this.id,
      analyzerVersion: this.version,
      computedAt,
    });

    const structural =
      analyzerObservations.get("structural") ?? [];

    const depthByPostId = new Map<string, number>();

    for (const observation of structural) {
      if (observation.type !== "structure.post.depth") {
        continue;
      }

      depthByPostId.set(
        observation.subject.id,
        observation.data.depth as number
      );
    }

    const postsByParticipant = new Map<string, Post[]>();
    const sentReplies = new Map<string, number>();
    const receivedReplies = new Map<string, number>();
    const uniqueRecipients = new Map<string, Set<string>>();
    const uniqueResponders = new Map<string, Set<string>>();
    const branchesParticipated = new Map<string, Set<string>>();
    const initiatedBranches = new Map<string, number>();
    const responseTimes = new Map<string, number[]>();
    const responseLatencies = new Map<string, number[]>();

    for (const participant of snapshot.participants) {
      postsByParticipant.set(participant, []);
      sentReplies.set(participant, 0);
      receivedReplies.set(participant, 0);
      uniqueRecipients.set(participant, new Set());
      uniqueResponders.set(participant, new Set());
      branchesParticipated.set(participant, new Set());
      initiatedBranches.set(participant, 0);
      responseTimes.set(participant, []);
      responseLatencies.set(participant, []);
    }

    for (const post of snapshot.posts) {
      postsByParticipant.get(post.authorIri)?.push(post);
    }

    for (const edge of snapshot.edges) {
      const parent = snapshot.postsById.get(edge.parentId)!;
      const child = snapshot.postsById.get(edge.childId)!;

      if (parent.authorIri !== child.authorIri) {
        sentReplies.set(child.authorIri, (sentReplies.get(child.authorIri) ?? 0) + 1);
        receivedReplies.set(parent.authorIri, (receivedReplies.get(parent.authorIri) ?? 0) + 1);

        uniqueRecipients.get(child.authorIri)?.add(parent.authorIri);
        uniqueResponders.get(parent.authorIri)?.add(child.authorIri);

        responseLatencies.get(child.authorIri)?.push(
          child.createdAt.getTime() - parent.createdAt.getTime()
        );
      }

      responseTimes.get(child.authorIri)?.push(
        child.createdAt.getTime() - parent.createdAt.getTime()
      );
    }

    const branchParticipants = structural.filter(
      observation => observation.type === "structure.branch.participants"
    );

    for (const observation of branchParticipants) {
      const participants =
        observation.data.participants as string[];

      for (const participant of participants) {
        branchesParticipated
          .get(participant)
          ?.add(observation.subject.id);
      }
    }

    for (const post of snapshot.posts) {
      const children =
        snapshot.childrenByParentId.get(post.id) ?? [];

      if (children.length > 1) {
        initiatedBranches.set(
          post.authorIri,
          (initiatedBranches.get(post.authorIri) ?? 0) + 1
        );
      }
    }

    const joinOrder =
      [...snapshot.participants]
        .sort((a, b) =>
          (postsByParticipant.get(a)?.[0]?.createdAt.getTime() ?? 0) -
          (postsByParticipant.get(b)?.[0]?.createdAt.getTime() ?? 0)
        );

    // ------------------------------------------------
    // Participants
    // ------------------------------------------------

    for (const participant of snapshot.participants) {
      const posts =
        postsByParticipant.get(participant) ?? [];

      const firstPost = posts[0];
      const lastPost = posts[posts.length - 1];

      const averageDepth =
        posts.length === 0
          ? 0
          : posts.reduce(
              (sum, post) => sum + (depthByPostId.get(post.id) ?? 0),
              0
            ) / posts.length;

      const averageResponseTime =
        this.average(responseTimes.get(participant) ?? []);

      const latency =
        this.average(responseLatencies.get(participant) ?? []);

      observe(
        { type: "participant", id: participant },
        "participation.participant.posts",
        {
          count: posts.length,
        }
      );

      observe(
        { type: "participant", id: participant },
        "participation.participant.post-share",
        {
          ratio: posts.length / Math.max(snapshot.posts.length, 1),
        }
      );

      observe(
        { type: "participant", id: participant },
        "participation.participant.sent-replies",
        {
          count: sentReplies.get(participant),
        }
      );

      observe(
        { type: "participant", id: participant },
        "participation.participant.received-replies",
        {
          count: receivedReplies.get(participant),
        }
      );

      observe(
        { type: "participant", id: participant },
        "participation.participant.unique-recipients",
        {
          count: uniqueRecipients.get(participant)?.size ?? 0,
        }
      );

      observe(
        { type: "participant", id: participant },
        "participation.participant.unique-responders",
        {
          count: uniqueResponders.get(participant)?.size ?? 0,
        }
      );

      observe(
        { type: "participant", id: participant },
        "participation.participant.branches-participated",
        {
          count: branchesParticipated.get(participant)?.size ?? 0,
        }
      );

      observe(
        { type: "participant", id: participant },
        "participation.participant.initiated-branches",
        {
          count: initiatedBranches.get(participant),
        }
      );

      observe(
        { type: "participant", id: participant },
        "participation.participant.first-post",
        {
          timestamp: firstPost?.createdAt ?? null,
        }
      );

      observe(
        { type: "participant", id: participant },
        "participation.participant.last-post",
        {
          timestamp: lastPost?.createdAt ?? null,
        }
      );

      observe(
        { type: "participant", id: participant },
        "participation.participant.active-duration",
        {
          milliseconds:
            firstPost && lastPost
              ? lastPost.createdAt.getTime() - firstPost.createdAt.getTime()
              : 0,
        }
      );

      observe(
        { type: "participant", id: participant },
        "participation.participant.average-depth",
        {
          depth: averageDepth,
        }
      );

      observe(
        { type: "participant", id: participant },
        "participation.participant.average-response-time",
        {
          milliseconds: averageResponseTime,
        }
      );

      observe(
        { type: "participant", id: participant },
        "participation.participant.response-latency",
        {
          milliseconds: latency,
        }
      );

      observe(
        { type: "participant", id: participant },
        "participation.participant.join-order",
        {
          index: joinOrder.indexOf(participant),
        }
      );
    }

    // ------------------------------------------------
    // Thread
    // ------------------------------------------------

    const participantCounts =
      [...postsByParticipant.values()].map(posts => posts.length);

    observe(
      { type: "thread", id: snapshot.thread.id },
      "participation.thread.concentration",
      {
        ratio: Math.max(...participantCounts, 0) / Math.max(snapshot.posts.length, 1),
      }
    );

    observe(
      { type: "thread", id: snapshot.thread.id },
      "participation.thread.gini",
      {
        value: this.gini(participantCounts),
      }
    );

    observe(
      { type: "thread", id: snapshot.thread.id },
      "participation.thread.newcomers",
      {
        count: participantCounts.filter(count => count === 1).length,
      }
    );

    observe(
      { type: "thread", id: snapshot.thread.id },
      "participation.thread.returning",
      {
        count: participantCounts.filter(count => count > 1).length,
      }
    );

    return observations;
  }

  private average(values: number[]): number {
    return values.length === 0
      ? 0
      : values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private gini(values: number[]): number {
    if (values.length === 0) {
      return 0;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const total = sorted.reduce((sum, value) => sum + value, 0);

    if (total === 0) {
      return 0;
    }

    let weighted = 0;

    for (let i = 0; i < sorted.length; i++) {
      weighted += (i + 1) * sorted[i];
    }

    return (2 * weighted) / (sorted.length * total) -
      (sorted.length + 1) / sorted.length;
  }
}