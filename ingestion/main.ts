// ingestion/main.ts

import { RedditCorpus } from "./reddit";
import { DojoAdapter } from "./dojo";


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

    case "subreddits":
      console.table(corpus.listSubreddits());
      break;

    case "subreddit": {
      if (!args.length) {
        throw new Error("Usage: subreddit <name>");
      }

      console.table(
        corpus.getSubreddit(args.join(" ")).map(s => ({
          id: s.id,
          comments: s.comment_count,
          score: s.score,
          author: s.author,
          title: s.title,
        }))
      );

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