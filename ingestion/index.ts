// ingestion/index.ts

import fs from "fs";
import Database from "better-sqlite3";
import { spawn } from "child_process";
import * as readline from "node:readline";

import {
  SubmissionIndexEntry,
} from "./types";

export class RedditIndex {
  private db: Database.Database;

  constructor(
    private dbPath: string,
    private submissionsPath: string,
    private commentsPath: string
  ) {
    this.db = new Database(dbPath);

    this.db.pragma("journal_mode = WAL");
    this.db.pragma("synchronous = NORMAL");
    this.db.pragma("temp_store = MEMORY");
    this.db.pragma("foreign_keys = OFF");
  }

  open() {
    this.createSchema();
  }

  close() {
    this.db.close();
  }

private parseSubmissionHeader(line: string): SubmissionIndexEntry {
  const extract = (key: string): string => {
    const match = line.match(
      new RegExp(`"${key}":"([^"]*)"`)
    );

    return match?.[1] ?? "";
  };

  const extractNumber = (key: string): number => {
    const match = line.match(
      new RegExp(`"${key}":(-?\\d+)`)
    );

    return match ? Number(match[1]) : 0;
  };

return {
  id: extract("id"),
  subreddit: extract("subreddit"),
  author: extract("author"),
  title: extract("title"),
  score: extractNumber("score"),
  created_utc: extractNumber("created_utc"),
  offset: 0,
};
}
  
private parseCommentHeader(line: string): {
  threadId: string;
} {
  const match = line.match(
    /"link_id":"t3_([^"]+)"/
  );

  if (!match) {
    throw new Error("Invalid Reddit comment");
  }

  return {
    threadId: match[1],
  };
}

  private createSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS submissions (
        id TEXT PRIMARY KEY,

        subreddit TEXT NOT NULL,
        author TEXT NOT NULL,
        title TEXT NOT NULL,

        score INTEGER NOT NULL,
        created_utc INTEGER NOT NULL,

        submission_offset INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS comments (
        thread_id TEXT PRIMARY KEY,
        comment_count INTEGER NOT NULL,
        offsets BLOB NOT NULL
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS submission_search
      USING fts5(
        id UNINDEXED,
        subreddit,
        author,
        title
      );

      CREATE INDEX IF NOT EXISTS idx_subreddit
      ON submissions(subreddit);

      CREATE INDEX IF NOT EXISTS idx_author
      ON submissions(author);

      CREATE INDEX IF NOT EXISTS idx_created
      ON submissions(created_utc);
    `);
  }

  needsRebuild(): boolean {
    const stmt = this.db.prepare(`
      SELECT value
      FROM metadata
      WHERE key = ?
    `);

    const submissionSize = stmt.get("submission_size") as any;
    const submissionMtime = stmt.get("submission_mtime") as any;

    const commentSize = stmt.get("comment_size") as any;
    const commentMtime = stmt.get("comment_mtime") as any;

    if (
      !submissionSize ||
      !submissionMtime ||
      !commentSize ||
      !commentMtime
    ) {
      return true;
    }

    const subStat = fs.statSync(this.submissionsPath);
    const comStat = fs.statSync(this.commentsPath);

    return (
      Number(submissionSize.value) !== subStat.size ||
      Number(submissionMtime.value) !== subStat.mtimeMs ||
      Number(commentSize.value) !== comStat.size ||
      Number(commentMtime.value) !== comStat.mtimeMs
    );
  }

  private writeMetadata() {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO metadata(key,value)
      VALUES (?,?)
    `);

    const sub = fs.statSync(this.submissionsPath);
    const com = fs.statSync(this.commentsPath);

    stmt.run("submission_size", String(sub.size));
    stmt.run("submission_mtime", String(sub.mtimeMs));

    stmt.run("comment_size", String(com.size));
    stmt.run("comment_mtime", String(com.mtimeMs));

    stmt.run("schema_version", "1");
  }

  async build() {
    console.log("Building index...");

    this.db.exec(`
      DELETE FROM submissions;
      DELETE FROM comments;
      DELETE FROM submission_search;
      DELETE FROM metadata;
    `);

    await this.buildSubmissions();
    await this.buildComments();

    this.writeMetadata();

    console.log("Index complete.");
  }

private async buildSubmissions() {
  console.log("Indexing submissions...");

  const insertSubmission = this.db.prepare(`
INSERT INTO submissions (
  id,
  subreddit,
  author,
  title,
  score,
  created_utc,
  submission_offset
)
VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertSearch = this.db.prepare(`
    INSERT INTO submission_search (
      id,
      subreddit,
      author,
      title
    )
    VALUES (?, ?, ?, ?)
  `);

  const filesize = fs.statSync(this.submissionsPath).size;

  const reader = readline.createInterface({
    input: fs.createReadStream(this.submissionsPath),
    crlfDelay: Infinity,
  });

  let offset = 0;
  let processed = 0;
  let lastPercent = -1;

  this.db.exec("BEGIN");

  try {
    for await (const line of reader) {
      if (!line.trim()) {
        offset += Buffer.byteLength(line) + 1;
        continue;
      }

      const raw = this.parseSubmissionHeader(line);

      insertSubmission.run(
        raw.id,
        raw.subreddit,
        raw.author,
        raw.title,
        raw.score,
        raw.created_utc,
        offset
      );

      insertSearch.run(
        raw.id,
        raw.subreddit,
        raw.author,
        raw.title
      );

      offset += Buffer.byteLength(line) + 1;

      processed++;

      const percent = Math.floor(
        offset * 100 / filesize
      );

      if (percent !== lastPercent) {
        lastPercent = percent;

        process.stdout.write(
          `\r${percent}% (${processed.toLocaleString()} submissions)`
        );
      }
    }

    this.db.exec("COMMIT");

    console.log("\nFinished submissions.");
  } catch (err) {
    this.db.exec("ROLLBACK");
    throw err;
  }
}

private async buildComments() {
  console.log("Indexing comments...");

  const tmpFile = `${this.dbPath}.comments.tmp`;

  const writer = fs.createWriteStream(tmpFile);

  const filesize = fs.statSync(this.commentsPath).size;

  const reader = readline.createInterface({
    input: fs.createReadStream(this.commentsPath),
    crlfDelay: Infinity,
  });

  let offset = 0;
  let processed = 0;
  let lastPercent = -1;

  for await (const line of reader) {
    if (!line.trim()) {
      offset += Buffer.byteLength(line) + 1;
      continue;
    }

    const comment = this.parseCommentHeader(line);

    writer.write(
      `${comment.threadId}\t${offset}\n`
    );

    offset += Buffer.byteLength(line) + 1;

    processed++;

    const percent = Math.floor(
      offset * 100 / filesize
    );

    if (percent !== lastPercent) {
      lastPercent = percent;

      process.stdout.write(
        `\r${percent}% (${processed.toLocaleString()} comments)`
      );
    }
  }

  await new Promise<void>(resolve => writer.end(resolve));

  console.log("\nSorting comments...");

  const sortedFile = await this.sortComments(tmpFile);

  console.log("Writing comment blobs...");

  await this.writeCommentBlobs(sortedFile);

  fs.unlinkSync(tmpFile);
  fs.unlinkSync(sortedFile);

  console.log("Finished comments.");
}

private sortComments(
  tmpFile: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const sortedFile = `${tmpFile}.sorted`;

    const sort = spawn("sort", [
      "-k1,1",
      tmpFile,
      "-o",
      sortedFile,
    ]);

    sort.stdout.on("data", data => {
      process.stdout.write(data);
    });

    sort.stderr.on("data", data => {
      process.stderr.write(data);
    });

    sort.on("error", reject);

    sort.on("close", code => {
      if (code !== 0) {
        reject(new Error(`sort exited with code ${code}`));
        return;
      }

      resolve(sortedFile);
    });
  });
}

private async writeCommentBlobs(
  sortedFile: string
) {
  const insert = this.db.prepare(`
INSERT INTO comments (
  thread_id,
  comment_count,
  offsets
)
VALUES (?, ?, ?)
  `);

  const reader = readline.createInterface({
    input: fs.createReadStream(sortedFile),
    crlfDelay: Infinity,
  });

  this.db.exec("BEGIN");

  try {
    let currentThread: string | null = null;
    let offsets: number[] = [];

    let written = 0;

    const flush = () => {
      if (!currentThread) {
        return;
      }

      const blob = Buffer.alloc(offsets.length * 8);

      for (let i = 0; i < offsets.length; i++) {
        blob.writeBigUInt64LE(
          BigInt(offsets[i]),
          i * 8
        );
      }

insert.run(
  currentThread,
  offsets.length,
  blob
);

      written++;

      if (written % 10000 === 0) {
        process.stdout.write(
          `\r${written.toLocaleString()} threads`
        );
      }
    };

    for await (const line of reader) {
      if (!line) {
        continue;
      }

      const tab = line.indexOf("\t");

      const threadId = line.slice(0, tab);
      const offset = Number(
        line.slice(tab + 1)
      );

      if (currentThread === null) {
        currentThread = threadId;
      }

      if (threadId !== currentThread) {
        flush();

        currentThread = threadId;
        offsets = [];
      }

      offsets.push(offset);
    }

    flush();

    this.db.exec("COMMIT");

    console.log(
      `\nStored ${written.toLocaleString()} threads.`
    );
  }
  catch (err) {
    this.db.exec("ROLLBACK");
    throw err;
  }
}

getSubmission(id: string): SubmissionIndexEntry | undefined {
  const stmt = this.db.prepare(`
    SELECT
      id,
      subreddit,
      author,
      title,
      score,
      created_utc,
      submission_offset AS offset
    FROM submissions
    WHERE id = ?
  `);

  return stmt.get(id) as SubmissionIndexEntry | undefined;
}

getCommentOffsets(threadId: string): number[] {
  const stmt = this.db.prepare(`
    SELECT offsets
    FROM comments
    WHERE thread_id = ?
  `);

  const row = stmt.get(threadId) as
    | { offsets: Buffer }
    | undefined;

  if (!row) {
    return [];
  }

  const offsets: number[] = [];

  for (let i = 0; i < row.offsets.length; i += 8) {
    offsets.push(
      Number(row.offsets.readBigUInt64LE(i))
    );
  }

  return offsets;
}

listSubreddits(): {
  name: string;
  threads: number;
}[] {
  const stmt = this.db.prepare(`
    SELECT
      subreddit AS name,
      COUNT(*) AS threads
    FROM submissions
    GROUP BY subreddit
    ORDER BY threads DESC
  `);

  return stmt.all() as {
    name: string;
    threads: number;
  }[];
}

listThreads(
  subreddit: string
): SubmissionIndexEntry[] {
  const stmt = this.db.prepare(`
SELECT
  s.id,
  s.subreddit,
  s.author,
  s.title,
  s.score,
  s.created_utc,
  s.submission_offset AS offset,
  COALESCE(c.comment_count, 0) AS comment_count

FROM submissions s

LEFT JOIN comments c
ON c.thread_id = s.id

WHERE s.subreddit = ?

ORDER BY comment_count DESC, s.score DESC;
  `);

  return stmt.all(subreddit) as SubmissionIndexEntry[];
}

search(
  query: string,
  limit = 100
): SubmissionIndexEntry[] {
  const stmt = this.db.prepare(`
    SELECT
      s.id,
      s.subreddit,
      s.author,
      s.title,
      s.created_utc,
      s.submission_offset AS offset
    FROM submission_search f
    JOIN submissions s
      ON s.id = f.id
    WHERE submission_search MATCH ?
    LIMIT ?
  `);

  return stmt.all(
    query,
    limit
  ) as SubmissionIndexEntry[];
}

randomSubmission(): SubmissionIndexEntry | undefined {
  const stmt = this.db.prepare(`
    SELECT
      id,
      subreddit,
      author,
      title,
      created_utc,
      submission_offset AS offset
    FROM submissions
    ORDER BY RANDOM()
    LIMIT 1
  `);

  return stmt.get() as
    | SubmissionIndexEntry
    | undefined;
}


}