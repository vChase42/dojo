import { Pool } from "pg";
import { Post } from "../../types";
import { PostReadService } from "./postReadService";

export class PostVotesService {
  constructor(
    private pg: Pool,
    private reads: PostReadService
  ) {}

  async vote(params: {
    postId: string;
    userIri: string;
    value: -1 | 0 | 1;
  }): Promise<Post> {
    const client = await this.pg.connect();

    try {
      await client.query("BEGIN");

      const existing = await client.query(
        `SELECT value FROM post_votes WHERE post_id = $1 AND user_iri = $2`,
        [params.postId, params.userIri]
      );

      const oldValue = existing.rowCount
        ? Number(existing.rows[0].value)
        : 0;

      const newValue = params.value;

      if (oldValue === newValue) {
        await client.query("COMMIT");
        return this.getPostOrThrow(params.postId, params.userIri);
      }

      if (newValue === 0) {
        await client.query(
          `DELETE FROM post_votes WHERE post_id = $1 AND user_iri = $2`,
          [params.postId, params.userIri]
        );
      } else if (oldValue === 0) {
        await client.query(
          `
          INSERT INTO post_votes (post_id, user_iri, value)
          VALUES ($1, $2, $3)
          `,
          [params.postId, params.userIri, newValue]
        );
      } else {
        await client.query(
          `
          UPDATE post_votes
          SET value = $3
          WHERE post_id = $1 AND user_iri = $2
          `,
          [params.postId, params.userIri, newValue]
        );
      }

      const upvoteDelta =
        (newValue === 1 ? 1 : 0) -
        (oldValue === 1 ? 1 : 0);

      const downvoteDelta =
        (newValue === -1 ? 1 : 0) -
        (oldValue === -1 ? 1 : 0);

      await client.query(
        `
        UPDATE posts
        SET
          upvotes = upvotes + $2,
          downvotes = downvotes + $3,
          updated_at = NOW()
        WHERE id = $1
        `,
        [params.postId, upvoteDelta, downvoteDelta]
      );

      await client.query("COMMIT");

      return this.getPostOrThrow(params.postId, params.userIri);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async getUserVote(
    postId: string,
    userIri: string
  ): Promise<-1 | 0 | 1> {
    const res = await this.pg.query(
      `SELECT value FROM post_votes WHERE post_id = $1 AND user_iri = $2`,
      [postId, userIri]
    );

    if (!res.rowCount) return 0;

    return Number(res.rows[0].value) as -1 | 1;
  }

  private async getPostOrThrow(
    postId: string,
    viewerIri: string
  ): Promise<Post> {
    const post = await this.reads.getPost({
      postId,
      viewerIri,
    });

    if (!post) {
      throw new Error("Post not found after vote mutation");
    }

    return post;
  }
}