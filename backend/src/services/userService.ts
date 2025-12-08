// src/services/userService.ts
import { Collection, Db, ObjectId } from "mongodb";
import bcrypt from "bcrypt";

export interface UserRecord {
  _id?: ObjectId;
  username: string;
  passwordHash: string;
  actorId: string;      // maps local user → ActivityPub "Person"
  createdAt: Date;
}

export class UserService {
  private users: Collection<UserRecord>;

  constructor(db: Db) {
    this.users = db.collection<UserRecord>("users");
  }

  /** Create a new local user + hashed password */
  async createUser(username: string, password: string, actorId: string) {
    const existing = await this.users.findOne({ username });
    if (existing) throw new Error("Username already taken");

    const passwordHash = await bcrypt.hash(password, 12);

    const user: UserRecord = {
      username,
      passwordHash,
      actorId,
      createdAt: new Date(),
    };

    await this.users.insertOne(user);
    return user;
  }

  /** Look up a user by username */
  async findByUsername(username: string) {
    return this.users.findOne({ username });
  }

  /** Verify a user's password */
  async verifyPassword(user: UserRecord, password: string) {
    return bcrypt.compare(password, user.passwordHash);
  }

  /** Look up a user by session-owned userId (optional helper) */
  async findById(id: string) {
    return this.users.findOne({ _id: new ObjectId(id) });
  }

}
