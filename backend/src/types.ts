// src/types.ts

export type Thread = {
  id: string; // root note IRI (AP ID)

  groupIri: string;

  title: string;
  creatorIri: string;

  replyCount: number;
  lastActivityAt: Date;

  isLocked: boolean;
  isPinned: boolean;
  isDeleted: boolean;

  // moderation
  moderationStatus:
    | "visible"
    | "deleted"
    | "hidden"
    | "moderated";

  deletedReason?: string | null;
  deletedBy?: string | null;
  deletedAt?: Date | null;

  createdAt: Date;
  updatedAt: Date;
};


export type Post = {
  id: string; // ActivityPub note IRI

  threadId: string; // root thread IRI
  parentId?: string | null;

  authorIri: string;

  content: string;

  // voting
  upvotes: number;
  downvotes: number;
  score: number;

  // reply/revision metadata
  replyCount: number;
  revisionCount: number;

  // timestamps
  createdAt: Date;
  updatedAt: Date;

  // deletion/moderation
  isDeleted: boolean;

  moderationStatus:
    | "visible"
    | "deleted"
    | "hidden"
    | "moderated";

  deletedReason?: string | null;
  deletedBy?: string | null;
  deletedAt?: Date | null;

  // viewer-specific state
  viewerVote: -1 | 0 | 1;

  // permissions
  canEdit: boolean;
  canDelete: boolean;
  canVote: boolean;
};


export type PostRevision = {
  id: string;               // revision UUID
  postId: string;

  revisionNumber: number;
  editorIri: string;

  content: string;
  editedAt: Date;

  editReason?: string | null;
};


export type User = {
  id: string;               // actorId (AP IRI)
  username: string;

  createdAt: Date;
};