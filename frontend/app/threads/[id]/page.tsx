"use client";
import "./thread.css";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  getThread,
  getThreadPosts,
  createPost,
  Thread,
  Post,
} from "../../services/threadService";
import { postTreeBuilder } from "./scripts/postTreeBuilder";
import type { PostTreeNode } from "./scripts/postTreeBuilder";

type ReplyState = {
  [postId: string]: boolean;
};

export default function ThreadPage() {
  const { id } = useParams();
  const threadId = id as string;

  const [thread, setThread] = useState<Thread | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [replyOpen, setReplyOpen] = useState<ReplyState>({});
  const [rootText, setRootText] = useState("");

  useEffect(() => {
    load();
  }, [threadId]);

  async function load() {
    const t = await getThread(threadId);
    const p = await getThreadPosts(threadId);
    console.log("post");
    console.log(p[0]);
    setThread(t);
    setPosts(p);
  }

  async function submitRootPost() {
    if (!rootText.trim()) return;
    await createPost({
      content: rootText,
      context: thread!.id,
    });
    setRootText("");
    await load();
  }

  async function submitReply(parentId: string, text: string) {
    if (!text.trim()) return;
    await createPost({
      content: text,
      context: thread!.id,
      inReplyTo: parentId,
    });
    setReplyOpen((r) => ({ ...r, [parentId]: false }));
    await load();
  }

  function PostRow({
    post,
    depth = 0,
  }: {
    post: PostTreeNode;
    depth?: number;
  }) {
    const [text, setText] = useState("");

    return (
      <>
        <div className="post" style={{ marginLeft: depth * 24 }}>
          <div className="post-meta">
            <div className="post-author">
              {post.attributedTo ?? "unknown"}
            </div>
            <div className="post-date">
              {post.created &&
                new Date(post.created).toLocaleString()}
            </div>
          </div>

          <div className="post-content">
            {post.content}
            <div className="post-actions">
              <button
                onClick={() =>
                  setReplyOpen((r) => ({
                    ...r,
                    [post.id]: !r[post.id],
                  }))
                }
              >
                reply
              </button>
            </div>
          </div>
        </div>

        {replyOpen[post.id] && (
          <div
            className="reply-box"
            style={{ marginLeft: depth * 24 + 160 }}
          >
            <textarea
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <button onClick={() => submitReply(post.id, text)}>
              post reply
            </button>
          </div>
        )}

        {post.children.length > 0 && (
          <div className="thread-indent">
            {post.children.map((child) => (
              <PostRow
                key={child.id}
                post={child}
                depth={depth + 1}
              />
            ))}
          </div>
        )}
      </>
    );
  }

  if (!thread) return <div>Loading…</div>;

  const tree = postTreeBuilder(posts);

  return (
    <main className="forum">
      <h1>{thread.name}</h1>

      <div>
        {tree.map((post) => (
          <PostRow key={post.id} post={post} />
        ))}
      </div>

      <div className="root-reply">
        <h3>Reply</h3>
        <textarea
          rows={5}
          value={rootText}
          onChange={(e) => setRootText(e.target.value)}
        />
        <button onClick={submitRootPost}>Post</button>
      </div>
    </main>
  );
}
