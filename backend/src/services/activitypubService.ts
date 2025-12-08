// src/services/activitypubService.ts

export class ActivityPubService {
  public apex: any;
  private db: any;

  constructor(apex: any, db: any) {
    this.apex = apex;
    this.db = db;
  }
  async createPersonActor(username: string, displayName?: string) {
    const actorIRI = this.apex.utils.usernameToIRI(username);

    // Safety: never overwrite an existing actor
    const existing = await this.apex.store.getObject(actorIRI);
    if (existing) {
      return existing;
    }

    const actor = await this.apex.createActor(
      username,                         // preferredUsername
      displayName || username,          // name
      `User ${username}`,               // summary
      {
        type: "Image",
        mediaType: "image/jpeg",
        url: `https://${this.apex.domain}/f/dojo.png`,
      },
      "Person"                          // ✅ THIS FIXES YOUR BUG
    );

    await this.apex.store.saveObject(actor);
    return actor.id;
  }

  /**
   * Fetch the logged-in user's outbox items (local only).
   * Not federated — your UI uses this if you want your own rendering.
   */
  async getOutbox(actorId: string, limit = 20) {
    return this.db
      .collection("streams")
      .find({ actor: actorId, type: "Create" })
      .sort({ _id: -1 })
      .limit(limit)
      .toArray();
  }
}
