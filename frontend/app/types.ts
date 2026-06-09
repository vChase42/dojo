// app/types.ts

/**
 * Thread metadata returned from:
 *   GET /api/threadstats
 *   GET /api/threads
 */
export interface Thread {
  id: string; // root post IRI

  groupIri: string;
  title: string;
  creatorIri: string;

  replyCount: number;
  lastActivityAt: string;

  isLocked: boolean;
  isPinned: boolean;
  isDeleted: boolean;

  moderationStatus: "visible" | "deleted" | "hidden" | "moderated";
  deletedReason: string | null;
  deletedBy: string | null;
  deletedAt: string | null;

  createdAt: string;
  updatedAt: string;
}

/**
 * Canonical Post DTO returned from API.
 */
export interface Post {
  id: string; // note IRI

  threadId: string;
  parentId: string | null;

  authorIri: string;
  content: string;

  replyCount: number;
  revisionCount: number;

  upvotes: number;
  downvotes: number;
  score: number;

  isDeleted: boolean;

  moderationStatus: "visible" | "deleted" | "hidden" | "moderated";
  deletedReason: string | null;
  deletedBy: string | null;
  deletedAt: string | null;

  viewerVote: -1 | 0 | 1;

  canEdit: boolean;
  canDelete: boolean;
  canVote: boolean;

  createdAt: string;
  updatedAt: string;
}

/**
 * Generic pagination metadata returned by paginated endpoints.
 */
export interface Pagination {
  page: number;
  limit: number;
  offset: number;

  total: number;
  totalPages: number;

  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Response shape for:
 *   GET /api/thread/:threadId
 */
export interface ThreadWithPosts {
  ok: boolean;
  thread: Thread | null;
  posts: Post[];
  pagination: Pagination;
}

/**
 * Response shape for:
 *   GET /api/threads
 */
export interface ThreadsResponse {
  ok: boolean;
  items: Thread[];
  pagination: Pagination;
}

/**
 * Nested frontend-only thread tree node.
 */
export type PostTreeNode = Post & {
  children: PostTreeNode[];
};