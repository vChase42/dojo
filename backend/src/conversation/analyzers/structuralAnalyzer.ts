// src/conversation/analyzers/structuralAnalyzer.ts

import { Post } from "../../types";
import {
  Analyzer,
  AnalysisContext,
  Observation,
  ObservationSubject,
} from "../core/types";

export class StructuralAnalyzer implements Analyzer {
  readonly id = "structural";
  readonly version = "0.1.0";

  readonly observationTypes = [
  "structure.thread.summary",

  "structure.post.depth",
  "structure.post.direct-replies",
  "structure.post.descendants",
  "structure.post.leaf",
  "structure.post.root",

  "structure.edge.summary",

  "structure.participant.summary",
];

  async analyze(context: AnalysisContext): Promise<Observation[]> {
    const { snapshot } = context;

    const observations: Observation[] = [];
    const computedAt = new Date();

    const observe = <T extends Record<string, unknown>>(
      subject: ObservationSubject,
      type: string,
      data: T
    ) => {
      observations.push({
        subject,
        type,
        analyzerId: this.id,
        analyzerVersion: this.version,
        data,
        computedAt,
      });
    };

    const depthByPostId = this.computeDepths(snapshot);
    const descendantsByPostId = this.computeDescendantCounts(snapshot);

    // Thread

    observe(
      { type: "thread", id: snapshot.thread.id },
      "structure.thread.summary",
      {
        postCount: snapshot.posts.length,
        edgeCount: snapshot.edges.length,
        participantCount: snapshot.participants.length,
        rootReplyCount:
          snapshot.childrenByParentId.get(snapshot.rootPost.id)?.length ?? 0,
        maxDepth: Math.max(0, ...depthByPostId.values()),
      }
    );

    // Posts

    for (const post of snapshot.posts) {
      const children = snapshot.childrenByParentId.get(post.id) ?? [];

      observe(
        { type: "post", id: post.id },
        "structure.post.depth",
        { depth: depthByPostId.get(post.id) ?? 0 }
      );

      observe(
        { type: "post", id: post.id },
        "structure.post.direct-replies",
        { count: children.length }
      );

      observe(
        { type: "post", id: post.id },
        "structure.post.descendants",
        { count: descendantsByPostId.get(post.id) ?? 0 }
      );

      observe(
        { type: "post", id: post.id },
        "structure.post.leaf",
        { value: children.length === 0 }
      );

      observe(
        { type: "post", id: post.id },
        "structure.post.root",
        { value: post.id === snapshot.rootPost.id }
      );
    }

    // Edges

    for (const edge of snapshot.edges) {
      const parent = snapshot.postsById.get(edge.parentId);
      const child = snapshot.postsById.get(edge.childId);

      if (!parent || !child) continue;

      observe(
        { type: "edge", id: this.edgeId(edge.parentId, edge.childId) },
        "structure.edge.summary",
        {
          parentId: edge.parentId,
          childId: edge.childId,
          parentDepth: depthByPostId.get(parent.id) ?? 0,
          childDepth: depthByPostId.get(child.id) ?? 0,
          sameAuthor: parent.authorIri === child.authorIri,
          responseTimeMs:
            child.createdAt.getTime() - parent.createdAt.getTime(),
        }
      );
    }

    // Participants

    for (const participant of snapshot.participants) {
      const authoredPosts = snapshot.posts.filter(
        (post) => post.authorIri === participant
      );

      const repliedTo = new Set<string>();
      const repliedToBy = new Set<string>();

      for (const post of authoredPosts) {
        if (!post.parentId) continue;

        const parent = snapshot.postsById.get(post.parentId);

        if (parent && parent.authorIri !== participant) {
          repliedTo.add(parent.authorIri);
        }
      }

      for (const post of snapshot.posts) {
        if (!post.parentId) continue;

        const parent = snapshot.postsById.get(post.parentId);

        if (
          parent?.authorIri === participant &&
          post.authorIri !== participant
        ) {
          repliedToBy.add(post.authorIri);
        }
      }

      observe(
        { type: "participant", id: participant },
        "structure.participant.summary",
        {
          postCount: authoredPosts.length,
          postShare:
            snapshot.posts.length === 0
              ? 0
              : authoredPosts.length / snapshot.posts.length,
          uniqueParticipantsRepliedTo: repliedTo.size,
          uniqueParticipantsRepliedToBy: repliedToBy.size,
        }
      );
    }

    return observations;
  }

  private computeDepths(
    snapshot: AnalysisContext["snapshot"]
  ): Map<string, number> {
    const depths = new Map<string, number>();

    const visit = (post: Post, depth: number) => {
      if (depths.has(post.id)) return;

      depths.set(post.id, depth);

      const children = snapshot.childrenByParentId.get(post.id) ?? [];

      for (const child of children) {
        visit(child, depth + 1);
      }
    };

    visit(snapshot.rootPost, 0);

    return depths;
  }

  private computeDescendantCounts(
    snapshot: AnalysisContext["snapshot"]
  ): Map<string, number> {
    const counts = new Map<string, number>();

    const count = (postId: string): number => {
      const existing = counts.get(postId);

      if (existing !== undefined) {
        return existing;
      }

      const children = snapshot.childrenByParentId.get(postId) ?? [];

      let total = 0;

      for (const child of children) {
        total += 1 + count(child.id);
      }

      counts.set(postId, total);

      return total;
    };

    for (const post of snapshot.posts) {
      count(post.id);
    }

    return counts;
  }

  private edgeId(parentId: string, childId: string): string {
    return `${parentId}::${childId}`;
  }
}