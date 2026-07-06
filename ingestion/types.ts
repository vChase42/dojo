// ingestion/types.ts

// ------------------------------------------------
// Raw Reddit Objects
// ------------------------------------------------

export interface RedditSubmission {
  id: string;
  name: string; // t3_xxxxx

  subreddit: string;
  subreddit_id: string;

  author: string;

  title: string;
  selftext: string;

  permalink: string;
  url: string;
  domain: string;

  created_utc: number;

  score: number;
  ups: number;
  downs: number;

  num_comments: number;

  over_18: boolean;
  is_self: boolean;
  hidden: boolean;

  distinguished: string | null;
  edited: boolean | number;

  link_flair_text: string | null;
  link_flair_css_class: string | null;

  author_flair_text: string | null;
  author_flair_css_class: string | null;
}

export interface RedditComment {
  id: string;
  name: string; // t1_xxxxx

  link_id: string; // t3_xxxxx
  parent_id: string; // t1_xxxxx or t3_xxxxx

  subreddit: string;
  subreddit_id: string;

  author: string;

  body: string;

  created_utc: number;

  score: number;
  ups: number;
  downs: number;

  controversiality: number;
  gilded: number;

  distinguished: string | null;
  edited: boolean | number;

  score_hidden: boolean;
  archived: boolean;

  author_flair_text: string | null;
  author_flair_css_class: string | null;
}

// ------------------------------------------------
// Indexed Submission
// ------------------------------------------------

export interface SubmissionIndexEntry {
  id: string;

  subreddit: string;
  author: string;
  title: string;

  score: number;
  created_utc: number;

  comment_count?: number;

  offset: number;
}

// ------------------------------------------------
// Normalized Objects
// ------------------------------------------------

export interface Submission extends RedditSubmission {
  createdAt: Date;
  threadId: string;
  authorIri: string;
}

export interface Comment extends RedditComment {
  createdAt: Date;

  commentId: string;
  threadId: string;

  parentCommentId: string | null;
  parentSubmissionId: string | null;

  authorIri: string;

  children: Comment[];
}

// ------------------------------------------------
// Thread
// ------------------------------------------------

export interface RedditThread {
  submission: Submission;
  comments: Comment[];
}