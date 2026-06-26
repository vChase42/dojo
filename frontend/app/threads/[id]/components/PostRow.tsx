"use client";

import { useState } from "react";
import type { PostTreeNode } from "@/app/types";
import { ReplyBox } from "./ReplyBox";
import { PostMenu } from "./PostMenu";

type PostRowProps = {
  post: PostTreeNode;
  depth?: number;
  maxIndentDepth?: number;

  onReply(parentId: string, text: string): Promise<void> | void;
  onEdit(postId: string, text: string): Promise<void> | void;
  onDelete(postId: string): Promise<void> | void;
  onVote(postId: string, currentVote: -1 | 0 | 1): Promise<void> | void;

  onHoverPost?(postId: string | null): void;
  highlightedPostId?: string | null;
};

export function PostRow({
  post,
  depth = 0,
  maxIndentDepth = 6,
  onReply,
  onEdit,
  onDelete,
  onVote,
  onHoverPost,
  highlightedPostId,
}: PostRowProps) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");

  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(post.content);

  const [submitting, setSubmitting] = useState(false);
  const isHighlighted = highlightedPostId === post.id;

  async function submitReply() {
    const content = replyText.trim();
    if (!content) return;

    setSubmitting(true);

    try {
      await onReply(post.id, content);
      setReplyText("");
      setReplyOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  async function submitEdit() {
    const content = editText.trim();

    if (!content || content === post.content) {
      setEditing(false);
      setEditText(post.content);
      return;
    }

    setSubmitting(true);

    try {
      await onEdit(post.id, content);
      setEditing(false);
    } finally {
      setSubmitting(false);
    }
  }

  async function submitVote() {
    if (!post.canVote || post.isDeleted || submitting) return;

    setSubmitting(true);

    try {
      await onVote(post.id, post.viewerVote);
    } finally {
      setSubmitting(false);
    }
  }

  function cancelEdit() {
    setEditing(false);
    setEditText(post.content);
  }

  return (
    <>
      <div
        className={`post ${
          depth > 0 ? "post-reply" : ""
        } ${isHighlighted ? "post-highlighted" : ""}`}
        onMouseEnter={() => onHoverPost?.(post.parentId ?? null)}
        onMouseLeave={() => onHoverPost?.(null)}
      >
        <div className="post-meta">
          <div className="post-author">
            {post.isDeleted ? <em>deleted</em> : post.authorIri}
          </div>

          <div className="post-date">
            {new Date(post.createdAt).toLocaleString()}
          </div>
        </div>

        <div className="post-content">
          <PostMenu
            canEdit={post.canEdit && !post.isDeleted}
            canDelete={post.canDelete && !post.isDeleted}
            onEdit={() => {
              setEditText(post.content);
              setEditing(true);
            }}
            onDelete={() => onDelete(post.id)}
          />

          {editing ? (
            <div className="edit-box">
              <ReplyBox
                value={editText}
                onChange={setEditText}
                onSubmit={submitEdit}
                buttonText="save"
                disabled={submitting}
              />

              <button
                type="button"
                onClick={cancelEdit}
                disabled={submitting}
              >
                cancel
              </button>
            </div>
          ) : (
            <div className="post-body">
              {post.isDeleted ? <em>deleted</em> : post.content}
            </div>
          )}

          <div className="post-actions">
            <span className="mr-2">score: {post.score}</span>

            {!post.isDeleted && post.canVote && (
              <span>
                [
                <a
                  href="#"
                  className="post-action-link"
                  title={post.viewerVote === 1 ? "Remove vote" : "Upvote"}
                  onClick={(e) => {
                    e.preventDefault();
                    submitVote();
                  }}
                >
                  {post.viewerVote === 1 ? "-" : "+"}
                </a>
                ]
              </span>
            )}

            {!post.isDeleted && (
              <button
                type="button"
                onClick={() => setReplyOpen((open) => !open)}
              >
                reply
              </button>
            )}
          </div>
        </div>
      </div>

      {replyOpen && (
        <div className="reply-box" style={{ marginLeft: 160 }}>
          <ReplyBox
            value={replyText}
            onChange={setReplyText}
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
              onEdit={onEdit}
              onDelete={onDelete}
              onVote={onVote}
              onHoverPost={onHoverPost}
              highlightedPostId={highlightedPostId}
            />
          ))}
        </div>
      )}
    </>
  );
}