"use client";

import { useState } from "react";
import type { PostTreeNode } from "@/app/types";
import { ReplyBox } from "./ReplyBox";

type PostRowProps = {
  post: PostTreeNode;
  depth?: number;
  maxIndentDepth?: number;
  onReply(parentId: string, text: string): Promise<void> | void;
  onHoverPost?(postId: string | null): void;
  highlightedPostId?: string | null;
};

export function PostRow({
  post,
  depth = 0,
  maxIndentDepth = 6,
  onReply,
  onHoverPost,
  highlightedPostId,
}: PostRowProps) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const visualDepth = Math.min(depth, maxIndentDepth);
  const isHighlighted = highlightedPostId === post.id;

  async function submitReply() {
    const content = text.trim();
    if (!content) return;

    setSubmitting(true);

    try {
      await onReply(post.id, content);
      setText("");
      setReplyOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div
        className={`post ${
          depth > 0 ? "post-reply" : ""
        } ${isHighlighted ? "post-highlighted" : ""}`}
        // style={{ marginLeft: visualDepth * 24 }}
        onMouseEnter={() => onHoverPost?.(post.parentId ?? null)}
        onMouseLeave={() => onHoverPost?.(null)}
      >
        <div className="post-meta">
          <div className="post-author">
            {post.authorIri ?? "unknown"}
          </div>

          <div className="post-date">
            {new Date(post.createdAt).toLocaleString()}
          </div>
        </div>

        <div className="post-content">
          {post.isDeleted ? <em>deleted</em> : post.content}

          <div className="post-actions">
            <span>score: {post.score}</span>

            <button
              type="button"
              onClick={() => setReplyOpen((open) => !open)}
            >
              reply
            </button>
          </div>
        </div>
      </div>

      {replyOpen && (
        <div
          className="reply-box"
          style={{ marginLeft: 160 }}
        >
          <ReplyBox
            value={text}
            onChange={setText}
            onSubmit={submitReply}
            disabled={submitting}
          />
        </div>
      )}

      {post.children.length > 0 && (
        <div
          className={
            depth < maxIndentDepth
              ? "thread-indent"
              : undefined
          }
        >
          {post.children.map((child) => (
            <PostRow
              key={child.id}
              post={child}
              depth={depth + 1}
              maxIndentDepth={maxIndentDepth}
              onReply={onReply}
              onHoverPost={onHoverPost}
              highlightedPostId={highlightedPostId}
            />
          ))}
        </div>
      )}
    </>
  );
}