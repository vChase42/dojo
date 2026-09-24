// ingestion/main.ts

import { RedditCorpus } from "./reddit";
import { DojoAdapter } from "./dojo";

function clip(value: string, width: number): string {
  if (width <= 0) return "";
  if (value.length <= width) return value.padEnd(width);
  return width === 1 ? "…" : value.slice(0, width - 1) + "…";
}
function threadLine(s: ReturnType<RedditCorpus["getSubreddit"]>[number]): string {
  const width = Math.max(60, process.stdout.columns || 100);
  const fixed = 7 + 7 + 9 + 18;
  const titleWidth = Math.max(20, width - fixed);
  return `${String(s.score).padStart(6)} ${String(s.comment_count).padStart(6)} ${clip(s.id, 8)} ${clip(s.author, 17)} ${clip(s.title.replace(/\s+/g, " "), titleWidth)}`;
}
async function pick<T>(items: T[], title: string, render: (item: T) => string): Promise<T | undefined> {
  if (!items.length) return undefined;
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    for (const item of items) console.log(render(item));
    return undefined;
  }
  let selected = 0;
  const pageSize = Math.max(5, (process.stdout.rows || 24) - 5);
  const draw = () => {
    const start = Math.max(0, Math.min(selected - Math.floor(pageSize / 2), items.length - pageSize));
    const end = Math.min(items.length, start + pageSize);
    process.stdout.write("\x1b[2J\x1b[H");
    process.stdout.write(`${title}  (${selected + 1}/${items.length})\n`);
    process.stdout.write("↑/↓ move  Enter open  q/Esc back\n\n");
    for (let i = start; i < end; i++) process.stdout.write(`${i === selected ? ">" : " "} ${render(items[i])}\n`);
  };
  return new Promise(resolve => {
    const stdin = process.stdin;
    const finish = (value?: T) => {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      process.stdout.write("\x1b[?25h\x1b[2J\x1b[H");
      resolve(value);
    };
    const onData = (data: Buffer) => {
      const key = data.toString();
      if (key === "\u0003") { finish(); process.exit(130); }
      if (key === "\r" || key === "\n") return finish(items[selected]);
      if (key === "q" || key === "\u001b") return finish();
      if (key === "\u001b[A" || key === "k") selected = Math.max(0, selected - 1);
      if (key === "\u001b[B" || key === "j") selected = Math.min(items.length - 1, selected + 1);
      draw();
    };
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", onData);
    process.stdout.write("\x1b[?25l");
    draw();
  });
}
async function browseSubreddit(corpus: RedditCorpus, name: string): Promise<void> {
  const threads = corpus.getSubreddit(name);
  const selected = await pick(threads, `r/${name}  score comments id       author            title`, threadLine);
  if (!selected) return;
  const thread = await corpus.getThread(selected.id);
  if (thread) console.log(corpus.renderThread(thread));
}


async function main() {
  const corpus = new RedditCorpus({
    dbPath: "reddit/2011-08.sqlite",
    submissionsPath: "reddit/submissions/RS_2011-08",
    commentsPath: "reddit/comments/RC_2011-08",
  });

  console.log("Initializing...");
  await corpus.initialize();

  const [command, ...args] = process.argv.slice(2);

  switch (command) {
    case "stats":
      console.table(corpus.stats());
      break;

    case "subreddits": {
      const subreddits = corpus.listSubreddits();
      const selected = await pick(subreddits, "Subreddits  threads name", s => `${String(s.threads).padStart(7)}  ${s.name}`);
      if (selected) await browseSubreddit(corpus, selected.name);
      break;
    }

    case "subreddit": {
      if (!args.length) {
        throw new Error("Usage: subreddit <name>");
      }

      await browseSubreddit(corpus, args.join(" "));
      break;
    }

    case "thread": {
      if (!args.length) {
        throw new Error("Usage: thread <submissionId>");
      }

      const thread = await corpus.getThread(args[0]);

      if (!thread) {
        console.log("Thread not found.");
        break;
      }

      console.log(corpus.renderThread(thread));
      break;
    }

    case "inspect": {
      if (!args.length) {
        throw new Error("Usage: inspect <submissionId>");
      }

      const thread = await corpus.getThread(args[0]);

      if (!thread) {
        console.log("Thread not found.");
        break;
      }

      console.table(corpus.inspectThread(thread));
      break;
    }

    case "comment": {
      if (!args.length) {
        throw new Error("Usage: comment <commentId>");
      }

      const comment = await corpus.getComment(args[0]);

      if (!comment) {
        console.log("Comment not found.");
        break;
      }

      console.log(corpus.renderComment(comment));
      break;
    }

    case "replies": {
      if (!args.length) {
        throw new Error("Usage: replies <commentId>");
      }

      const replies = await corpus.getReplies(args[0]);

      console.table(
        replies.map(c => ({
          id: c.commentId,
          author: c.author,
          score: c.score,
          body:
            c.body.length > 80
              ? c.body.slice(0, 80) + "..."
              : c.body,
        }))
      );

      break;
    }

    case "json": {
      if (args.length < 2) {
        throw new Error(
          "Usage: json thread|comment <id>"
        );
      }

      if (args[0] === "thread") {
        const thread = await corpus.getThread(args[1]);

        if (!thread) {
          console.log("Thread not found.");
          break;
        }

        console.log(JSON.stringify(thread, null, 2));
        break;
      }

      if (args[0] === "comment") {
        const comment = await corpus.getComment(args[1]);

        if (!comment) {
          console.log("Comment not found.");
          break;
        }

        console.log(corpus.renderCommentJson(comment));
        break;
      }

      throw new Error(
        "json expects 'thread' or 'comment'"
      );
    }

    case "search": {
      const query = args.join(" ");

      if (!query) {
        throw new Error("Usage: search <query>");
      }

      console.table(
        corpus.searchSubmissions(query).map(s => ({
          id: s.id,
          subreddit: s.subreddit,
          author: s.author,
          title: s.title,
        }))
      );

      break;
    }
    case "import-thread": {
      if (args.length < 2) {
        throw new Error(
          "Usage: import-thread <submissionId> <groupName>"
        );
      }

      const [submissionId, groupName] = args;

      const thread = await corpus.getThread(submissionId);

      if (!thread) {
        console.log("Thread not found.");
        break;
      }

      const dojo = new DojoAdapter();

      try {
        console.log("Initializing Dojo...");

        await dojo.initialize();

        await dojo.importThread(thread, groupName);
      } finally {
        await dojo.close();
      }

      break;
    }
    case "random": {
      const submission = corpus.randomSubmission();

      if (!submission) {
        console.log("No submissions.");
        break;
      }

      const thread = await corpus.getThread(submission.id);

      if (!thread) {
        console.log("Thread not found.");
        break;
      }

      console.log(corpus.renderThread(thread));
      break;
    }

    default:
      console.log(`
Commands

stats
subreddits
subreddit <name>

thread <submissionId>
inspect <submissionId>

comment <commentId>
replies <commentId>

json thread <submissionId>
json comment <commentId>

search <query>

import-thread <submissionId> <groupName>

random
`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});