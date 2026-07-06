// ingestion/dojo.ts

// @ts-ignore
import { Pool } from "../backend/node_modules/pg";

import { PostsService } from "../backend/src/services/postsService";
import { ThreadService } from "../backend/src/services/threadService";
import { ForumService } from "../backend/src/services/forumService";

import type { RedditThread } from "./types";

export class DojoAdapter {
  private pg!: any;

  private posts!: PostsService;
  private threads!: ThreadService;
  private forum!: ForumService;

  async initialize(): Promise<void> {
    console.log("🐘 Connecting PostgreSQL...");

    this.pg = new Pool({
      host: process.env.PG_HOST || "localhost",
      port: Number(process.env.PG_PORT) || 5432,
      user: process.env.PG_USER || "dojo",
      password: process.env.PG_PASSWORD || "dojo",
      database: process.env.PG_DB || "dojo",
    });

    await this.pg.query("SELECT 1");

    console.log("✅ PostgreSQL connected.");

    this.posts = new PostsService(this.pg);
    this.threads = new ThreadService(this.pg);
    await this.posts.initialize();
    await this.threads.initialize();

    // Safe because this adapter ONLY calls
    // ForumService.importThread() / importPost().
    this.forum = new ForumService(
      undefined as any,
      this.posts,
      this.threads
    );

    console.log("🥋 Dojo adapter ready.");
  }

  async close(): Promise<void> {
    if (this.pg) {
      await this.pg.end();
    }
  }

async importThread(
  thread: RedditThread,
  groupName: string
): Promise<void> {
  const domain = "localhost";

  if (!domain) {
    throw new Error("DOMAIN must be set in .env");
  }

  const groupIri = `https://${domain}/u/${groupName}`;

  const threadId = `reddit:t3_${thread.submission.id}`;

  const totalComments = this.countComments(thread.comments);

  console.log(`Importing "${thread.submission.title}"`);
  console.log(`Comments: ${totalComments}`);

  let imported = 0;

  await this.forum.importThread({
    id: threadId,
    actorIri: `reddit:${thread.submission.author}`,
    title: thread.submission.title,
    groupIri,
    publishedAt: thread.submission.createdAt,
  });


  const submissionPostId = `reddit:t3_${thread.submission.id}:submission`;
  await this.forum.importPost({
    id: submissionPostId,
    threadId,
    actorIri: `reddit:${thread.submission.author}`,
    parentId: threadId,
    publishedAt: thread.submission.createdAt,
    content: thread.submission.is_self
        ? thread.submission.selftext
        : thread.submission.url,
});

  await this.importComments(
    threadId,
    thread.comments,
    () => {
      imported++;

      if (
        imported <= 10 ||
        imported % 100 === 0 ||
        imported === totalComments
      ) {
        console.log(
          `[${imported}/${totalComments}]`
        );
      }
    }
  );

  console.log("✅ Import complete.");
}

private async importComments(
  threadId: string,
  comments: import("./types").Comment[],
  onImported: () => void
): Promise<void> {
  for (const comment of comments) {
    const parentId = comment.parentCommentId
      ? `reddit:t1_${comment.parentCommentId}`
      : threadId;

    await this.forum.importPost({
      id: `reddit:t1_${comment.commentId}`,
      threadId,
      actorIri: `reddit:${comment.author}`,
      content: comment.body,
      parentId,
      publishedAt: comment.createdAt,
    });

    onImported();

    if (comment.children.length) {
      await this.importComments(
        threadId,
        comment.children,
        onImported
      );
    }
  }
}

private countComments(
  comments: import("./types").Comment[]
): number {
  let total = 0;

  for (const comment of comments) {
    total++;

    total += this.countComments(comment.children);
  }

  return total;
}
}