"use client";
import "./thread.css";
import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  getThread,
  createPost,
  NoteObject,
  ThreadStats,
} from "../../services/threadService";
import { postTreeBuilder } from "./scripts/postTreeBuilder";
import type { PostTreeNode } from "./scripts/postTreeBuilder";
import { useMe } from "@/app/hooks/me";

type ReplyState = {
  [postId: string]: boolean;
};

export default function ThreadPage() {
  const { data: user, isLoading } = useMe();
  const { id } = useParams();
  const shortId = id as string;

  const [notes, setNotes] = useState<NoteObject[]>([]);
  const [threadStats, setThreadStats] = useState<ThreadStats | null>(null);
  const [replyOpen, setReplyOpen] = useState<ReplyState>({});
  const [rootText, setRootText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Scroll persistence
  useEffect(() => {
    const saveScroll = () => {
      sessionStorage.setItem("thread-scroll-y", window.scrollY.toString());
    };

    window.addEventListener("beforeunload", saveScroll);
    return () => window.removeEventListener("beforeunload", saveScroll);
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem("thread-scroll-y");
    if (!saved) return;
    window.scrollTo(0, Number(saved));
  }, [loading]);

  useEffect(() => {
    load();
  }, [shortId]);

  async function load() {
    setLoading(true);
    setError(false);

    try {
      const threadId = shortId.startsWith("http")
        ? shortId
        : `https://localhost/o/${shortId}`;

      const data = await getThread(threadId);

      if (data.threadStats) {
        setThreadStats(data.threadStats);
      }

      setNotes(data.notes ?? []);
    } catch (err) {
      console.error("Failed to load thread", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  const rootNote = useMemo(
    () => notes.find((n) => n._local?.threadRoot === n.id),
    [notes]
  );

  const commentNotes = useMemo(
    () => notes.filter((n) => n.id !== rootNote?.id),
    [notes, rootNote]
  );

  /*
   * Add note locally instead of refetching entire thread
   */
  function appendNoteLocally(newNote: NoteObject) {
    setNotes((prev) => [...prev, newNote]);
  }

  async function submitThreadReply() {
    if (!rootText.trim() || !rootNote) return;

    const result = await createPost({
      content: rootText,
      inReplyTo: rootNote.id,
      context: rootNote.context ?? undefined,
    });

    // Optimistic append
    appendNoteLocally({
      id: result.noteId,
      type: "Note",
      content: rootText,
      attributedTo: user!.actorId,
      published: new Date().toISOString(),
      inReplyTo: rootNote.id,
      _local: {
        threadRoot: rootNote._local!.threadRoot,
        depth: 1,
      },
    } as NoteObject);

    setRootText("");
  }

  async function submitReply(parentId: string, text: string) {
    if (!text.trim() || !rootNote) return;

    const parent = notes.find((n) => n.id === parentId);

    const result = await createPost({
      content: text,
      inReplyTo: parentId,
      context: rootNote.context ?? undefined,
    });

    appendNoteLocally({
      id: result.noteId,
      type: "Note",
      content: text,
      attributedTo: user!.actorId,
      published: new Date().toISOString(),
      inReplyTo: parentId,
      _local: {
        threadRoot: rootNote._local!.threadRoot,
        depth: (parent?._local?.depth ?? 0) + 1,
      },
    } as NoteObject);

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
            {post.children.map((child: any) => (
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

  const tree = postTreeBuilder(commentNotes);

  return (
    <main className="forum">
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ display: "inline", marginRight: "0.75rem" }}>
          {rootNote?.content ?? threadStats?.title ?? "Thread"}
        </h1>
        <span style={{ color: "#9aa4b2", fontSize: "0.9rem" }}>
          {rootNote?.attributedTo ?? "unknown"}
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
