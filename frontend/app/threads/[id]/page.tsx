// app/threads/[id]/page.tsx
"use client";

import "./thread.css";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  getThread,
  createPost,
  deletePost,
} from "../../services/threadsService";
import { buildPostTree } from "../../services/utils";
import type { Post, Thread } from "@/app/types";
import { useMe } from "@/app/hooks/me";
import { PostRow } from "./components/PostRow";
import { ReplyBox } from "./components/ReplyBox";

function threadIdFromParam(id: string): string {
  return id.startsWith("http")
    ? id
    : `https://localhost/o/${id}`;
}

function makeLocalPost(params: {
  id: string;
  threadId: string;
  parentId: string | null;
  authorIri: string;
  content: string;
}): Post {
  const now = new Date().toISOString();

  return {
    id: params.id,
    threadId: params.threadId,
    parentId: params.parentId,

    authorIri: params.authorIri,
    content: params.content,

    replyCount: 0,
    revisionCount: 1,

    upvotes: 0,
    downvotes: 0,
    score: 0,

    isDeleted: false,

    moderationStatus: "visible",
    deletedReason: null,
    deletedBy: null,
    deletedAt: null,

    viewerVote: 0,

    canEdit: true,
    canDelete: true,
    canVote: false,

    createdAt: now,
    updatedAt: now,
  };
}

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
  const [rootText, setRootText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [highlightedPostId, setHighlightedPostId] =
    useState<string | null>(null);

  useEffect(() => {
    if (!shortId) return;
    load(shortId);
  }, [shortId]);

  async function load(id: string) {
    setLoading(true);
    setError(false);

    try {
      const data = await getThread({
        threadId: threadIdFromParam(id),
        page: 1,
      });

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
    () => posts.find((post) => post.id === thread?.id) ?? null,
    [posts, thread]
  );

  const commentPosts = useMemo(
    () => posts.filter((post) => post.parentId !== null),
    [posts]
  );

  const tree = useMemo(
    () => buildPostTree(commentPosts),
    [commentPosts]
  );

  function appendPostLocally(post: Post) {
    setPosts((prev) => [...prev, post]);
  }

  async function submitThreadReply() {
    if (!rootText.trim() || !rootPost || !thread || !user) return;

    const content = rootText.trim();

    const result = await createPost({
      content,
      inReplyTo: rootPost.id,
      context: thread.groupIri,
    });

    appendPostLocally(
      makeLocalPost({
        id: result.noteId,
        threadId: thread.id,
        parentId: rootPost.id,
        authorIri: user.actorId,
        content,
      })
    );

    setRootText("");
  }

  async function submitReply(parentId: string, text: string) {
    if (!text.trim() || !thread || !user) return;

    const content = text.trim();

    const result = await createPost({
      content,
      inReplyTo: parentId,
      context: thread.groupIri,
    });

    appendPostLocally(
      makeLocalPost({
        id: result.noteId,
        threadId: thread.id,
        parentId,
        authorIri: user.actorId,
        content,
      })
    );
  }

  async function deleteThreadPost(noteIri: string) {
    const updatedPost = await deletePost({
      noteIri,
      reason: "User deleted post",
    });

    setPosts((prev) =>
      prev.map((post) =>
        post.id === updatedPost.id ? updatedPost : post
      )
    );
  }

  if (loading) return <div>Loading…</div>;
  if (error) return <div>Thread not found.</div>;

  return (
    <main className="forum">
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ display: "inline", marginRight: "0.75rem" }}>
          {rootPost?.content ?? thread?.title ?? "Thread"}
        </h1>

        <span style={{ color: "#9aa4b2", fontSize: "0.9rem" }}>
          {rootPost?.authorIri ?? thread?.creatorIri ?? "unknown"}
        </span>
      </div>

      <div className="thread-surface">
        {tree.map((post) => (
          <PostRow
            key={post.id}
            post={post}
            maxIndentDepth={6}
            onReply={submitReply}
            onEdit={() => {}}
            onDelete={deleteThreadPost}
            onHoverPost={setHighlightedPostId}
            highlightedPostId={highlightedPostId}
          />
        ))}

        <div className="root-reply">
          <h3>Reply</h3>

          <ReplyBox
            rows={5}
            value={rootText}
            onChange={setRootText}
            onSubmit={submitThreadReply}
            buttonText="Post"
            disabled={!user}
          />
        </div>
      </div>
    </main>
  );
}