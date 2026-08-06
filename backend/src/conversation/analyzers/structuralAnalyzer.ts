import { Post } from "../../types";
import {
  Analyzer,
  AnalysisContext,
  Observation,
} from "../core/types";
import { createObserver } from "./utils";

export class StructuralAnalyzer implements Analyzer {
  readonly id = "structural";
  readonly version = "0.1.0";

  readonly observationTypes = [
    // Thread
    "structure.thread.post-count",
    "structure.thread.edge-count",
    "structure.thread.participant-count",
    "structure.thread.root-replies",
    "structure.thread.maximum-depth",
    "structure.thread.average-depth",
    "structure.thread.maximum-width",
    "structure.thread.leaf-posts",

    // Post
    "structure.post.depth",
    "structure.post.is-root",
    "structure.post.is-leaf",
    "structure.post.direct-replies",
    "structure.post.descendants",
    "structure.post.sibling-count",
    "structure.post.child-index",
    "structure.post.subtree-size",

    // Edge
    "structure.edge.parent-depth",
    "structure.edge.child-depth",
    "structure.edge.depth-change",
    "structure.edge.same-author",
    "structure.edge.response-time",

    // Branch
    "structure.branch.size",
    "structure.branch.participants",
    "structure.branch.leaves",
    "structure.branch.maximum-depth",
    "structure.branch.average-depth",
    "structure.branch.direct-branches",
    "structure.branch.fork-count",

    // Path
    "structure.path.length",
    "structure.path.posts",
    "structure.path.participants",
    "structure.path.response-times",
    "structure.path.average-response-time",
    "structure.path.same-author-ratio",
    "structure.path.branch-points",
  ];

  async analyze(context: AnalysisContext): Promise<Observation[]> {
    const { snapshot } = context;

    const observations: Observation[] = [];
    const computedAt = new Date();

    const observe = createObserver({
      observations,
      analyzerId: this.id,
      analyzerVersion: this.version,
      computedAt,
    });

    // ------------------------------------------------
    // Graph
    // ------------------------------------------------

    const depthByPostId = this.computeDepths(snapshot);
    const descendantsByPostId = this.computeDescendantCounts(snapshot);
    const branchByPostId = this.computeBranches(snapshot);
    const pathByPostId = this.computePaths(snapshot);

    const leafPostIds = new Set(
      snapshot.posts
        .filter(post => (snapshot.childrenByParentId.get(post.id)?.length ?? 0) === 0)
        .map(post => post.id)
    );

    // ------------------------------------------------
    // Thread
    // ------------------------------------------------

    const depths = [...depthByPostId.values()];
    const widthsByDepth = new Map<number, number>();

    for (const depth of depths) {
      widthsByDepth.set(depth, (widthsByDepth.get(depth) ?? 0) + 1);
    }

    const widths = [...widthsByDepth.values()];

    const maximumDepth = Math.max(0, ...depths);
    const averageDepth =
      depths.reduce((sum, depth) => sum + depth, 0) / Math.max(1, depths.length);
    const maximumWidth = Math.max(0, ...widths);

    observe(
      { type: "thread", id: snapshot.thread.id },
      "structure.thread.post-count",
      {
        count: snapshot.posts.length,
      }
    );

    observe(
      { type: "thread", id: snapshot.thread.id },
      "structure.thread.edge-count",
      {
        count: snapshot.edges.length,
      }
    );

    observe(
      { type: "thread", id: snapshot.thread.id },
      "structure.thread.participant-count",
      {
        count: snapshot.participants.length,
      }
    );

    observe(
      { type: "thread", id: snapshot.thread.id },
      "structure.thread.root-replies",
      {
        count:
          snapshot.childrenByParentId.get(snapshot.rootPost.id)?.length ?? 0,
      }
    );

    observe(
      { type: "thread", id: snapshot.thread.id },
      "structure.thread.maximum-depth",
      {
        depth: maximumDepth,
      }
    );

    observe(
      { type: "thread", id: snapshot.thread.id },
      "structure.thread.average-depth",
      {
        depth: averageDepth,
      }
    );

    observe(
      { type: "thread", id: snapshot.thread.id },
      "structure.thread.maximum-width",
      {
        count: maximumWidth,
      }
    );

    observe(
      { type: "thread", id: snapshot.thread.id },
      "structure.thread.leaf-posts",
      {
        posts: [...leafPostIds],
      }
    );

    // ------------------------------------------------
    // Posts
    // ------------------------------------------------

    for (const post of snapshot.posts) {
      const children = snapshot.childrenByParentId.get(post.id) ?? [];
      const siblings = post.parentId
        ? snapshot.childrenByParentId.get(post.parentId) ?? []
        : [post];

      observe(
        { type: "post", id: post.id },
        "structure.post.depth",
        {
          depth: depthByPostId.get(post.id) ?? 0,
        }
      );

      observe(
        { type: "post", id: post.id },
        "structure.post.direct-replies",
        {
          count: children.length,
        }
      );

      observe(
        { type: "post", id: post.id },
        "structure.post.descendants",
        {
          count: descendantsByPostId.get(post.id) ?? 0,
        }
      );

      observe(
        { type: "post", id: post.id },
        "structure.post.is-root",
        {
          value: post.id === snapshot.rootPost.id,
        }
      );

      observe(
        { type: "post", id: post.id },
        "structure.post.is-leaf",
        {
          value: children.length === 0,
        }
      );

      observe(
        { type: "post", id: post.id },
        "structure.post.sibling-count",
        {
          count: siblings.length - 1,
        }
      );

      observe(
        { type: "post", id: post.id },
        "structure.post.child-index",
        {
          index: siblings.findIndex(sibling => sibling.id === post.id),
        }
      );

      observe(
        { type: "post", id: post.id },
        "structure.post.subtree-size",
        {
          count: 1 + (descendantsByPostId.get(post.id) ?? 0),
        }
      );
    }
    // ------------------------------------------------
    // Edges
    // ------------------------------------------------

    for (const edge of snapshot.edges) {
      const parent = snapshot.postsById.get(edge.parentId);
      const child = snapshot.postsById.get(edge.childId);

      if (!parent || !child) continue;

      const parentDepth = depthByPostId.get(parent.id) ?? 0;
      const childDepth = depthByPostId.get(child.id) ?? 0;
      const responseTime =
        child.createdAt.getTime() - parent.createdAt.getTime();

      observe(
        { type: "edge", id: this.edgeId(edge.parentId, edge.childId) },
        "structure.edge.parent-depth",
        {
          depth: parentDepth,
        }
      );

      observe(
        { type: "edge", id: this.edgeId(edge.parentId, edge.childId) },
        "structure.edge.child-depth",
        {
          depth: childDepth,
        }
      );

      observe(
        { type: "edge", id: this.edgeId(edge.parentId, edge.childId) },
        "structure.edge.depth-change",
        {
          depth: childDepth - parentDepth,
        }
      );

      observe(
        { type: "edge", id: this.edgeId(edge.parentId, edge.childId) },
        "structure.edge.same-author",
        {
          value: parent.authorIri === child.authorIri,
        }
      );

      observe(
        { type: "edge", id: this.edgeId(edge.parentId, edge.childId) },
        "structure.edge.response-time",
        {
          milliseconds: responseTime,
        }
      );
    }

    // ------------------------------------------------
    // Branches
    // ------------------------------------------------

    for (const post of snapshot.posts) {
      const branch = branchByPostId.get(post.id)!;

      const participants = [...new Set(branch.map(post => post.authorIri))];

      const leaves = branch
        .filter(post => leafPostIds.has(post.id))
        .map(post => post.id);

      const branchDepths = branch.map(
        post => depthByPostId.get(post.id) ?? 0
      );

      const maximumBranchDepth = Math.max(...branchDepths);

      const averageBranchDepth =
        branchDepths.reduce((sum, depth) => sum + depth, 0) /
        branchDepths.length;

      const directBranches =
        snapshot.childrenByParentId.get(post.id)?.length ?? 0;

      const forkCount = branch.filter(
        post => (snapshot.childrenByParentId.get(post.id)?.length ?? 0) > 1
      ).length;

      observe(
        { type: "branch", id: post.id },
        "structure.branch.size",
        {
          count: branch.length,
        }
      );

      observe(
        { type: "branch", id: post.id },
        "structure.branch.participants",
        {
          participants,
        }
      );

      observe(
        { type: "branch", id: post.id },
        "structure.branch.leaves",
        {
          posts: leaves,
        }
      );

      observe(
        { type: "branch", id: post.id },
        "structure.branch.maximum-depth",
        {
          depth: maximumBranchDepth,
        }
      );

      observe(
        { type: "branch", id: post.id },
        "structure.branch.average-depth",
        {
          depth: averageBranchDepth,
        }
      );

      observe(
        { type: "branch", id: post.id },
        "structure.branch.direct-branches",
        {
          count: directBranches,
        }
      );

      observe(
        { type: "branch", id: post.id },
        "structure.branch.fork-count",
        {
          count: forkCount,
        }
      );
    }

    // ------------------------------------------------
    // Paths
    // ------------------------------------------------

    for (const post of snapshot.posts) {
      const path = pathByPostId.get(post.id)!;
      const participants = [...new Set(path.map(post => post.authorIri))];

      const responseTimes = path.slice(1).map(
        (post, index) =>
          post.createdAt.getTime() - path[index].createdAt.getTime()
      );

      const averageResponseTime =
        responseTimes.length === 0
          ? 0
          : responseTimes.reduce((sum, ms) => sum + ms, 0) /
            responseTimes.length;

      const sameAuthorRatio =
        path.length <= 1
          ? 1
          : path.slice(1).filter(
              (post, index) => post.authorIri === path[index].authorIri
            ).length /
            (path.length - 1);

      const branchPoints = path.filter(
        post => (snapshot.childrenByParentId.get(post.id)?.length ?? 0) > 1
      ).length;

      observe(
        { type: "path", id: post.id },
        "structure.path.length",
        {
          count: path.length,
        }
      );

      observe(
        { type: "path", id: post.id },
        "structure.path.posts",
        {
          posts: path.map(post => post.id),
        }
      );

      observe(
        { type: "path", id: post.id },
        "structure.path.participants",
        {
          participants,
        }
      );

      observe(
        { type: "path", id: post.id },
        "structure.path.response-times",
        {
          milliseconds: responseTimes,
        }
      );

      observe(
        { type: "path", id: post.id },
        "structure.path.average-response-time",
        {
          milliseconds: averageResponseTime,
        }
      );

      observe(
        { type: "path", id: post.id },
        "structure.path.same-author-ratio",
        {
          ratio: sameAuthorRatio,
        }
      );

      observe(
        { type: "path", id: post.id },
        "structure.path.branch-points",
        {
          count: branchPoints,
        }
      );
    }

    return observations;
  }

  // ------------------------------------------------
  // Graph helpers
  // ------------------------------------------------

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

  private computePaths(
    snapshot: AnalysisContext["snapshot"]
  ): Map<string, Post[]> {
    const paths = new Map<string, Post[]>();

    const build = (post: Post): Post[] => {
      const existing = paths.get(post.id);

      if (existing) {
        return existing;
      }

      const path = post.parentId
        ? [...build(snapshot.postsById.get(post.parentId)!), post]
        : [post];

      paths.set(post.id, path);

      return path;
    };

    for (const post of snapshot.posts) {
      build(post);
    }

    return paths;
  }

  private computeBranches(
    snapshot: AnalysisContext["snapshot"]
  ): Map<string, Post[]> {
    const branches = new Map<string, Post[]>();

    const build = (post: Post): Post[] => {
      const existing = branches.get(post.id);

      if (existing) {
        return existing;
      }

      const children = snapshot.childrenByParentId.get(post.id) ?? [];

      const branch = [post];

      for (const child of children) {
        branch.push(...build(child));
      }

      branches.set(post.id, branch);

      return branch;
    };

    build(snapshot.rootPost);

    return branches;
  }

  private edgeId(parentId: string, childId: string): string {
    return `${parentId}::${childId}`;
  }
}