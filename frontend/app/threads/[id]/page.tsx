"use client";
import "./thread.css";
import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  getThread,
  createPost,
} from "../../services/threadService";
import { buildPostTree } from "../../services/utils";
import type { PostTreeNode } from "@/app/types";
import { useMe } from "@/app/hooks/me";
import { Post, Thread } from "@/app/types";

type ReplyState = {
  [postId: string]: boolean;
};

export default function ThreadPage() {
  const { data: user } = useMe();
  const params = useParams();

  const shortId =
    typeof params.id === "string"
      ? params.id
      : Array.isArray(params.id)
      ? params.id[0]
      : null;
  const [posts, setPosts] = useState<Post[]>([]);
  const [thread, setThread] = useState<Thread | null>(null);
  const [replyOpen, setReplyOpen] = useState<ReplyState>({});
  const [rootText, setRootText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!shortId) return;
    load(shortId);
  }, [shortId]);

  async function load(id: string) {
    setLoading(true);
    setError(false);

    try {
      const threadId = id.startsWith("http")
        ? id
        : `https://localhost/o/${id}`;
      const data = await getThread({threadId, page: 1});

      setThread(data.thread ?? null);
      setPosts(data.posts ?? []);
    } catch (err) {
      console.error("Failed to load thread", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  const rootPost = useMemo(
    () => posts.find((p) => p.id === thread?.id),
    [posts, thread]
  );

  const commentPosts = useMemo(
    () => posts.filter((p) => p.parentId !== null),
    [posts]
  );

  function appendPostLocally(newPost: Post) {
    setPosts((prev) => [...prev, newPost]);
  }

  async function submitThreadReply() {
    if (!rootText.trim() || !rootPost || !thread || !user) return;

    const result = await createPost({
      content: rootText,
      inReplyTo: rootPost.id,
      context: thread.groupIri,
    });

    appendPostLocally({
      id: result.noteId,
      threadId: thread.id,
      parentId: rootPost.id,
      authorIri: user.actorId,
      content: rootText,
      replyCount: 0,
      upvotes: 0,
      downvotes: 0,
      isDeleted: false,
      createdAt: new Date().toISOString(),
    });

    setRootText("");
  }

  async function submitReply(parentId: string, text: string) {
    if (!text.trim() || !thread || !user) return;

    const result = await createPost({
      content: text,
      inReplyTo: parentId,
      context: thread.groupIri,
    });

    appendPostLocally({
      id: result.noteId,
      threadId: thread.id,
      parentId,
      authorIri: user.actorId,
      content: text,
      replyCount: 0,
      upvotes: 0,
      downvotes: 0,
      isDeleted: false,
      createdAt: new Date().toISOString(),
    });

    setReplyOpen((r) => ({ ...r, [parentId]: false }));
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
              {post.authorIri ?? "unknown"}
            </div>
            <div className="post-date">
              {new Date(post.createdAt).toLocaleString()}
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

  if (loading) return <div>Loading…</div>;
  if (error) return <div>Thread not found.</div>;

  const tree = buildPostTree(commentPosts);

  return (
    <main className="forum">
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ display: "inline", marginRight: "0.75rem" }}>
          {rootPost?.content ?? thread?.title ?? "Thread"}
        </h1>
        <span style={{ color: "#9aa4b2", fontSize: "0.9rem" }}>
          {rootPost?.authorIri ?? "unknown"}
        </span>
      </div>

      <div className="thread-surface">
        {tree.map((post) => (
          <PostRow key={post.id} post={post} />
        ))}

        <div className="root-reply">
          <h3>Reply</h3>
          <textarea
            rows={5}
            value={rootText}
            onChange={(e) => setRootText(e.target.value)}
          />
          <button onClick={submitThreadReply}>Post</button>
        </div>
      </div>
    </main>
  );
}