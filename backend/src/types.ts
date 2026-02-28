// src/types.ts

export type Thread = {
  id: string;                 // root note IRI (AP ID)
  groupIri: string;

  title: string;
  creatorIri: string;

  replyCount: number;
  lastActivityAt: Date;

  isLocked: boolean;
  isPinned: boolean;
  isDeleted: boolean;

  createdAt: Date;
};


export type Post = {
  id: string;                 // note IRI (AP ID)
  threadId: string;           // root thread IRI
  authorIri: string;

  content: string;

  parentId?: string | null;   // reply support

  upvotes: number;
  downvotes: number;
  score: number;              // derived (upvotes - downvotes)

  replyCount: number;         // direct replies
  revisionCount: number;      // total revisions

  createdAt: Date;
  updatedAt: Date;

  isDeleted: boolean;
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