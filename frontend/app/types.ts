// app/types.ts

/**
 * Thread metadata returned from:
 *   GET /api/thread/stats
 *   GET /api/threads
 */
export interface Thread {
  id: string;              // root post IRI (threadId)
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
 * This is your normalized Postgres domain object.
 * No ActivityPub JSON-LD shapes here.
 */
export interface Post {
  id: string;              // note IRI
  threadId: string;        // root post IRI
  parentId: string | null; // direct parent post id

  authorIri: string;
  content: string;

  replyCount: number;      // direct children count
  upvotes: number;
  downvotes: number;

  isDeleted: boolean;

  createdAt: string;
  updatedAt?: string;      // optional if your API returns it
}


/**
 * Response shape for:
 *   GET /api/thread/:threadId
 */
export interface ThreadWithPosts {
  ok: boolean;
  thread: Thread | null;
  posts: Post[];
}


/**
 * Tree node used for nested UI rendering.
 * Pure frontend type.
 */
export type PostTreeNode = Post & {
  children: PostTreeNode[];
};