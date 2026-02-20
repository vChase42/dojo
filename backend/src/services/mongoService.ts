// src/services/mongoService.ts

import { Db } from "mongodb";

export class MongoService {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  /**
   * Fetch all notes belonging to a thread.
   * Sorted by published timestamp ascending.
   */
  async getThreadNotes(threadRoot: string) {
    if (!threadRoot || typeof threadRoot !== "string") {
      throw new Error("Invalid threadRoot");
    }

    return this.db
      .collection("objects")
      .find({
        type: "Note",
        "_local.threadRoot": threadRoot,
      })
      .sort({ published: 1 })
      .toArray();
  }
}
