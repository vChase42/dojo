// app/services/utils.ts

import { Post, PostTreeNode } from "@/app/types";

/**
 * Build nested tree structure from flat Post[].
 * Uses parentId instead of ActivityPub inReplyTo.
 */
export function buildPostTree(posts: Post[]): PostTreeNode[] {
  const byId = new Map<string, PostTreeNode>();
  const roots: PostTreeNode[] = [];

  for (const post of posts) {
    byId.set(post.id, {
      ...post,
      children: [],
    });
  }

  for (const post of posts) {
    const node = byId.get(post.id);
    if (!node) continue;

    const parent = post.parentId
      ? byId.get(post.parentId)
      : null;

    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  sortPostTree(roots);
  return roots;
}

/**
 * Recursively sort tree nodes by createdAt, oldest first.
 */
export function sortPostTree(nodes: PostTreeNode[]): void {
  nodes.sort(
    (a, b) =>
      new Date(a.createdAt).getTime() -
      new Date(b.createdAt).getTime()
  );

  for (const node of nodes) {
    sortPostTree(node.children);
  }
}

/**
 * Flatten a tree back into a depth-first list.
 */
export function flattenPostTree(
  nodes: PostTreeNode[]
): PostTreeNode[] {
  const result: PostTreeNode[] = [];

  for (const node of nodes) {
    result.push(node);
    result.push(...flattenPostTree(node.children));
  }

  return result;
}

/**
 * Prefer post.score from the API, but keep this helper
 * for optimistic UI updates.
 */
export function postScore(post: Post): number {
  return post.score;
}