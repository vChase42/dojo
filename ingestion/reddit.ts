// ingestion/reddit.ts

import fs from "fs";
import { RedditIndex } from ".";

import {
  Submission,
  Comment,
  RedditThread,
  RedditSubmission,
  RedditComment,
  SubmissionIndexEntry,
} from "./types";

export class RedditCorpus {
  private readonly submissionsPath: string;
  private readonly commentsPath: string;

  private readonly index: RedditIndex;

  private threadCache = new Map<string, RedditThread>();

  constructor(params: {
    submissionsPath: string;
    commentsPath: string;
    dbPath: string;
  }) {
    this.submissionsPath = params.submissionsPath;
    this.commentsPath = params.commentsPath;

    this.index = new RedditIndex(
      params.dbPath,
      params.submissionsPath,
      params.commentsPath
    );

    this.index.open();
  }

  async initialize(): Promise<void> {
    if (this.index.needsRebuild()) {
      await this.index.build();
    }
  }


  private readLine(
  path: string,
  offset: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(path, {
      start: offset,
    });

    let line = "";

    stream.on("data", chunk => {
      line += chunk.toString();

      const newline = line.indexOf("\n");

      if (newline !== -1) {
        stream.destroy();
        resolve(line.slice(0, newline));
      }
    });

    stream.on("error", reject);

    stream.on("close", () => {
      if (line.length) {
        resolve(line);
      }
    });
  });
}

// ------------------------------------------------
// Loading
// ------------------------------------------------



// ------------------------------------------------
// Stats
// ------------------------------------------------

stats() {
  const subreddits = this.index.listSubreddits();

  return {
    submissions: subreddits.reduce(
      (sum, s) => sum + s.threads,
      0
    ),
    subreddits: subreddits.length,
    cachedThreads: this.threadCache.size,
  };
}


// ------------------------------------------------
// Lookup
// ------------------------------------------------

async getSubmission(
  id: string
): Promise<Submission | undefined> {
  const header = this.index.getSubmission(id);

  if (!header) {
    return undefined;
  }

  const line = await this.readLine(
    this.submissionsPath,
    header.offset
  );

  const raw = JSON.parse(line) as RedditSubmission;

  return {
    ...raw,
    createdAt: new Date(raw.created_utc * 1000),
    threadId: raw.id,
    authorIri: `reddit:${raw.author}`,
  };
}



getSubreddit(name: string): SubmissionIndexEntry[] {
  return this.index.listThreads(name);
}



listSubreddits(): {
  name: string;
  threads: number;
}[] {
  return this.index.listSubreddits();
}

randomSubmission(): SubmissionIndexEntry | undefined {
  return this.index.randomSubmission();
}

searchSubmissions(
  query: string
): SubmissionIndexEntry[] {
  return this.index.search(query);
}

// ------------------------------------------------
// Threads
// ------------------------------------------------

async getThread(
  submissionId: string
): Promise<RedditThread | undefined> {
  const cached = this.threadCache.get(submissionId);
  if (cached) {
    return cached;
  }

  const submission = await this.getSubmission(submissionId);

  if (!submission) {
    return undefined;
  }

  const offsets = this.index.getCommentOffsets(submissionId);

  const comments: Comment[] = [];

  for (const offset of offsets) {
    const line = await this.readLine(
      this.commentsPath,
      offset
    );

    const raw = JSON.parse(line) as RedditComment;

    comments.push({
      ...raw,
      createdAt: new Date(raw.created_utc * 1000),

      commentId: raw.id,
      threadId: submissionId,

      parentCommentId:
        raw.parent_id.startsWith("t1_")
          ? this.stripPrefix(raw.parent_id)
          : null,

      parentSubmissionId:
        raw.parent_id.startsWith("t3_")
          ? this.stripPrefix(raw.parent_id)
          : null,

      authorIri: `reddit:${raw.author}`,

      children: [],
    });
  }

  const byId = new Map<string, Comment>();

  for (const comment of comments) {
    byId.set(comment.commentId, comment);
  }

  const roots: Comment[] = [];

  for (const comment of comments) {
    if (!comment.parentCommentId) {
      roots.push(comment);
      continue;
    }

    const parent = byId.get(comment.parentCommentId);

    if (parent) {
      parent.children.push(comment);
    } else {
      roots.push(comment);
    }
  }

  const sortTree = (nodes: Comment[]) => {
    nodes.sort((a, b) => a.created_utc - b.created_utc);

    for (const node of nodes) {
      sortTree(node.children);
    }
  };

  sortTree(roots);

  const thread: RedditThread = {
    submission,
    comments: roots,
  };

  this.threadCache.set(submissionId, thread);

  return thread;
}

private stripPrefix(id: string): string {
  const index = id.indexOf("_");
  return index === -1 ? id : id.slice(index + 1);
}

// ------------------------------------------------
// Comments
// ------------------------------------------------

async getComment(
  commentId: string
): Promise<Comment | undefined> {
  for (const thread of this.threadCache.values()) {
    const comment = this.findComment(
      commentId,
      thread.comments
    );

    if (comment) {
      return comment;
    }
  }

  return undefined;
}

async getReplies(commentId: string): Promise<Comment[]> {
  const comment = await this.getComment(commentId);
  return comment?.children ?? [];
}

private findComment(
  commentId: string,
  comments: Comment[]
): Comment | undefined {
  for (const comment of comments) {
    if (comment.commentId === commentId) {
      return comment;
    }

    const found = this.findComment(commentId, comment.children);

    if (found) {
      return found;
    }
  }

  return undefined;
}


// ------------------------------------------------
// Rendering
// ------------------------------------------------

renderThread(thread: RedditThread): string {
  const lines: string[] = [];

  const s = thread.submission;

  lines.push(s.subreddit);
  lines.push("");

  lines.push(s.title);
  lines.push("");

  if (s.is_self) {
    if (s.selftext.trim()) {
      lines.push(s.selftext);
      lines.push("");
    }
  } else {
    lines.push(s.url);
    lines.push("");
  }

  lines.push("------------------------------------------------------------");
  lines.push(`Author   : ${s.author}`);
  lines.push(`Score    : ${s.score}`);
  lines.push(`Comments : ${this.countComments(thread)}`);
  lines.push(`Created  : ${s.createdAt.toISOString()}`);
  lines.push("------------------------------------------------------------");
  lines.push("");

  for (const comment of thread.comments) {
    this.renderCommentTree(comment, lines, 0);
  }

  return lines.join("\n");
}

renderComment(comment: Comment): string {
  return [
    `Comment: ${comment.commentId}`,
    `Author : ${comment.author}`,
    `Score  : ${comment.score}`,
    `Parent : ${comment.parent_id}`,
    `Thread : ${comment.threadId}`,
    `Created: ${comment.createdAt.toISOString()}`,
    "",
    comment.body,
  ].join("\n");
}

renderCommentJson(comment: Comment): string {
  return JSON.stringify(comment, null, 2);
}

renderSubmissionJson(submission: Submission): string {
  return JSON.stringify(submission, null, 2);
}

private renderCommentTree(
  comment: Comment,
  lines: string[],
  depth: number
) {
  const indent = "  ".repeat(depth);

  lines.push(
    `${indent}├─ [${comment.commentId}] ${comment.author} (+${comment.score})`
  );

  const body = comment.body.trim();

  if (body) {
    for (const line of body.split("\n")) {
      lines.push(`${indent}│  ${line}`);
    }
  }

  lines.push("");

  for (const child of comment.children) {
    this.renderCommentTree(child, lines, depth + 1);
  }
}

// ------------------------------------------------
// Statistics
// ------------------------------------------------

countComments(thread: RedditThread): number {
  return this.countCommentTree(thread.comments);
}

private countCommentTree(comments: Comment[]): number {
  let count = 0;

  for (const comment of comments) {
    count++;
    count += this.countCommentTree(comment.children);
  }

  return count;
}



// ------------------------------------------------
// Inspection
// ------------------------------------------------

inspectThread(thread: RedditThread) {
  return {
    subreddit: thread.submission.subreddit,
    author: thread.submission.author,
    title: thread.submission.title,
    createdAt: thread.submission.createdAt,

    score: thread.submission.score,
    rootComments: thread.comments.length,
    totalComments: this.countComments(thread),

    maxDepth: this.maxDepth(thread.comments),
    deletedComments: this.deletedComments(thread.comments),
    distinctAuthors: this.distinctAuthors(thread.comments),
  };
}

private maxDepth(
  comments: Comment[],
  depth = 1
): number {
  let max = depth;

  for (const comment of comments) {
    max = Math.max(
      max,
      this.maxDepth(comment.children, depth + 1)
    );
  }

  return comments.length ? max : depth - 1;
}

private deletedComments(comments: Comment[]): number {
  let deleted = 0;

  for (const comment of comments) {
    if (
      comment.author === "[deleted]" ||
      comment.body === "[deleted]"
    ) {
      deleted++;
    }

    deleted += this.deletedComments(comment.children);
  }

  return deleted;
}

private distinctAuthors(comments: Comment[]): number {
  const authors = new Set<string>();

  const visit = (nodes: Comment[]) => {
    for (const comment of nodes) {
      authors.add(comment.author);
      visit(comment.children);
    }
  };

  visit(comments);

  return authors.size;
}

}