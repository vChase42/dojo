// src/services/activitypubService.ts

export class ActivityPubService {
  public apex: any;
  private db: any;

  constructor(apex: any, db: any) {
    this.apex = apex;
    this.db = db;
  }

  /**
   * Create a Note + Create Activity for a given actor.
   * This inserts into the outbox and triggers federation delivery.
   */
  async createPost(actorId: string, content: string) {
    const apex = this.apex;

    // 1. Build the Note object
    const note = {
      type: "Note",
      attributedTo: actorId,
      content,
      to: [apex.consts.publicAddress],
      cc: []
    };

    // 2. Save the Note into the AP object store
    const savedNote = await apex.store.saveObject(note);

    // 3. Build the Create activity
    const createActivity = await apex.buildActivity(
      "Create",
      actorId,
      [apex.consts.publicAddress],
      { object: [savedNote] }
    );

    // 4. Add the activity to the actor's outbox (this triggers delivery)
    await apex.addToOutbox({ id: actorId }, createActivity);

    // 5. Return the final stored note/activity to controller
    return {
      note: savedNote,
      activity: createActivity
    };
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
