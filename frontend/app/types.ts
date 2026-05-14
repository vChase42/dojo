// app/types.ts

/**
 * Thread metadata returned from:
 *   GET /api/threadstats
 *   GET /api/threads
 */
export interface Thread {
  id: string; // root post IRI (threadId)

  groupIri: string;
  title: string;
  creatorIri: string;

  replyCount: number;
  lastActivityAt: string;

  isLocked: boolean;
  isPinned: boolean;
  isDeleted: boolean;

  createdAt: string;
}

/**
 * Canonical Post model returned from:
 *   GET /api/thread/:threadId
 *   POST /api/editpost
 *
 * Normalized backend domain object.
 * No ActivityPub JSON-LD structures here.
 */
export interface Post {
  id: string; // note IRI

  threadId: string; // root thread IRI
  parentId: string | null;

  authorIri: string;
  content: string;

  replyCount: number;

  upvotes: number;
  downvotes: number;

  isDeleted: boolean;

  createdAt: string;
  updatedAt?: string;
}

/**
 * Generic pagination metadata
 * returned by paginated endpoints.
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
 * Nested frontend-only thread tree node.
 */
export type PostTreeNode = Post & {
  children: PostTreeNode[];
};