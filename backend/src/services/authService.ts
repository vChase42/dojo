// src/services/authService.ts
import { randomBytes } from "crypto";
import { Collection, Db } from "mongodb";

export interface SessionRecord {
  _id?: string;
  sessionId: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
}

export class AuthService {
  private sessions: Collection<SessionRecord>;

  constructor(db: Db) {
    this.sessions = db.collection<SessionRecord>("sessions");
    this.sessions.createIndex({ sessionId: 1 }, { unique: true });
    this.sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  }

  /** Create a new session for a user */
  async createSession(userId: string, ttlMinutes = 60 * 24) {
    const sessionId = randomBytes(30).toString("hex");

    const record: SessionRecord = {
      sessionId,
      userId,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + ttlMinutes * 60_000),
    };

    await this.sessions.insertOne(record);
    return sessionId;
  }

  /** Validate a session and return associated userId */
  async validateSession(sessionId: string) {
    const session = await this.sessions.findOne({ sessionId });
    if (!session) return null;

    if (session.expiresAt < new Date()) {
      await this.sessions.deleteOne({ sessionId });
      return null;
    }

    return session.userId;
  }

  /** Kill a specific session */
  async deleteSession(sessionId: string) {
    await this.sessions.deleteOne({ sessionId });
  }

  /** Kill all sessions for a user (optional) */
  async deleteUserSessions(userId: string) {
    await this.sessions.deleteMany({ userId });
  }
}
