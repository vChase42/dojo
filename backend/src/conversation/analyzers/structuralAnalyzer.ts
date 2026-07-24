// src/conversation/analyzers/structuralAnalyzer.ts

import { Post } from "../../types";
import {
  Analyzer,
  AnalysisContext,
  Observation,
} from "../core/types";

export class StructuralAnalyzer implements Analyzer {
  readonly id = "structural";
  readonly version = "0.1.0";

  async analyze(
    context: AnalysisContext
  ): Promise<Observation[]> {
    const { snapshot } = context;
    const observations: Observation[] = [];
    const computedAt = new Date();

    const depthByPostId = this.computeDepths(context);
    const descendantsByPostId = this.computeDescendantCounts(context);

    // Thread
    observations.push({
      subject: {
        type: "thread",
        id: snapshot.thread.id,
      },
      kind: "structure.thread",
      analyzerId: this.id,
      analyzerVersion: this.version,
      data: {
        postCount: snapshot.posts.length,
        edgeCount: snapshot.edges.length,
        participantCount: snapshot.participants.length,
        rootReplyCount:
          snapshot.childrenByParentId.get(snapshot.rootPost.id)?.length ?? 0,
        maxDepth: Math.max(0, ...depthByPostId.values()),
      },
      computedAt,
    });

    // Posts
    for (const post of snapshot.posts) {
      const children =
        snapshot.childrenByParentId.get(post.id) ?? [];

      observations.push({
        subject: {
          type: "post",
          id: post.id,
        },
        kind: "structure.post",
        analyzerId: this.id,
        analyzerVersion: this.version,
        data: {
          depth: depthByPostId.get(post.id) ?? 0,
          directReplyCount: children.length,
          descendantCount:
            descendantsByPostId.get(post.id) ?? 0,
          isLeaf: children.length === 0,
          isRoot: post.id === snapshot.rootPost.id,
        },
        computedAt,
      });
    }

    // Edges
    for (const edge of snapshot.edges) {
      const parent = snapshot.postsById.get(edge.parentId);
      const child = snapshot.postsById.get(edge.childId);

      if (!parent || !child) continue;

      observations.push({
        subject: {
          type: "edge",
          id: this.edgeId(edge.parentId, edge.childId),
        },
        kind: "structure.edge",
        analyzerId: this.id,
        analyzerVersion: this.version,
        data: {
          parentId: edge.parentId,
          childId: edge.childId,
          parentDepth: depthByPostId.get(parent.id) ?? 0,
          childDepth: depthByPostId.get(child.id) ?? 0,
          sameAuthor: parent.authorIri === child.authorIri,
          responseTimeMs:
            child.createdAt.getTime() -
            parent.createdAt.getTime(),
        },
        computedAt,
      });
    }

    // Participants
    for (const participantIri of snapshot.participants) {
      const authoredPosts = snapshot.posts.filter(
        (post) => post.authorIri === participantIri
      );

      const repliedTo = new Set<string>();
      const repliedToBy = new Set<string>();

      for (const post of authoredPosts) {
        if (!post.parentId) continue;

        const parent =
          snapshot.postsById.get(post.parentId);

        if (
          parent &&
          parent.authorIri !== participantIri
        ) {
          repliedTo.add(parent.authorIri);
        }
      }

      for (const post of snapshot.posts) {
        if (!post.parentId) continue;

        const parent =
          snapshot.postsById.get(post.parentId);

        if (
          parent?.authorIri === participantIri &&
          post.authorIri !== participantIri
        ) {
          repliedToBy.add(post.authorIri);
        }
      }

      observations.push({
        subject: {
          type: "participant",
          id: participantIri,
        },
        kind: "structure.participant",
        analyzerId: this.id,
        analyzerVersion: this.version,
        data: {
          postCount: authoredPosts.length,
          postShare:
            snapshot.posts.length === 0
              ? 0
              : authoredPosts.length / snapshot.posts.length,
          uniqueParticipantsRepliedTo: repliedTo.size,
          uniqueParticipantsRepliedToBy: repliedToBy.size,
        },
        computedAt,
      });
    }

    return observations;
  }

  private computeDepths(
    context: AnalysisContext
  ): Map<string, number> {
    const { snapshot } = context;
    const depths = new Map<string, number>();

    const visit = (post: Post, depth: number) => {
      if (depths.has(post.id)) return;

      depths.set(post.id, depth);

      const children =
        snapshot.childrenByParentId.get(post.id) ?? [];

      for (const child of children) {
        visit(child, depth + 1);
      }
    };

    visit(snapshot.rootPost, 0);

    return depths;
  }

  private computeDescendantCounts(
    context: AnalysisContext
  ): Map<string, number> {
    const { snapshot } = context;
    const counts = new Map<string, number>();

    const count = (postId: string): number => {
      const existing = counts.get(postId);

      if (existing !== undefined) {
        return existing;
      }

      const children =
        snapshot.childrenByParentId.get(postId) ?? [];

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

  private edgeId(
    parentId: string,
    childId: string
  ): string {
    return `${parentId}::${childId}`;
  }
}