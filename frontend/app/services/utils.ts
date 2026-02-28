// app/services/utils.ts

import { Post, PostTreeNode } from "@/app/types";

/**
 * Build nested tree structure from flat Post[]
 * Uses parentId instead of inReplyTo.
 */
export function buildPostTree(posts: Post[]): PostTreeNode[] {
  const map: Record<string, PostTreeNode> = {};
  const roots: PostTreeNode[] = [];

  // Initialize map
  for (const post of posts) {
    map[post.id] = {
      ...post,
      children: [],
    };
  }

  // Link children → parents
  for (const post of posts) {
    if (post.parentId && map[post.parentId]) {
      map[post.parentId].children.push(map[post.id]);
    } else {
      roots.push(map[post.id]);
    }
  }

  sortRecursively(roots);

  return roots;
}

/**
 * Recursively sort by createdAt (oldest first).
 */
function sortRecursively(nodes: PostTreeNode[]) {
  nodes.sort((a, b) => {
    return (
      new Date(a.createdAt).getTime() -
      new Date(b.createdAt).getTime()
    );
  });

  for (const node of nodes) {
    sortRecursively(node.children);
  }
}

/**
 * Optional: flatten a tree back into array (depth-first)
 */
export function flattenPostTree(
  nodes: PostTreeNode[]
): PostTreeNode[] {
  const result: PostTreeNode[] = [];

  function walk(list: PostTreeNode[]) {
    for (const node of list) {
      result.push(node);
      if (node.children.length > 0) {
        walk(node.children);
      }
    }
  }

  walk(nodes);
  return result;
}

/**
 * Optional: compute net score
 */
export function postScore(post: Post): number {
  return post.upvotes - post.downvotes;
}