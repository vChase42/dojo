import { Post } from "../../types";

export function mapPost(
  row: any,
  viewerIri?: string | null
): Post {
  return {
    id: row.id,

    threadId: row.thread_id,
    parentId: row.parent_id,

    authorIri: row.author_iri,
    content: row.content,

    upvotes: row.upvotes,
    downvotes: row.downvotes,
    score: row.upvotes - row.downvotes,

    replyCount: row.reply_count,
    revisionCount: row.revision_count,

    createdAt: row.created_at,
    updatedAt: row.updated_at,

    isDeleted: row.is_deleted,

    // moderation
    moderationStatus:
      row.moderation_status ?? "visible",

    deletedReason:
      row.deleted_reason ?? null,

    deletedBy:
      row.deleted_by ?? null,

    deletedAt:
      row.deleted_at ?? null,

    // viewer state
    viewerVote:
      row.viewer_vote ?? 0,

    // permissions
    canEdit:
      viewerIri != null &&
      viewerIri === row.author_iri,

    canDelete:
      viewerIri != null &&
      viewerIri === row.author_iri,

    canVote:
      viewerIri != null &&
      viewerIri !== row.author_iri,
  };
}