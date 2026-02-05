import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import https from "https";
import fs from "fs";
import path from "path";
import { Db, MongoClient } from "mongodb";
import { Pool } from "pg";
import { onShutdown } from "node-graceful-shutdown";
import cookieParser from "cookie-parser";
// SERVICES
import { AuthService } from "./services/authService";
import { UserService } from "./services/userService";
import { ActivityPubService } from "./services/activitypubService";

// ROUTES
import { authRoutes } from "./routes/authRoutes";
import { postRoutes } from "./routes/postRoutes";
import { publicRoutes } from "./routes/publicRoutes";

// AP SERVER
import { setupActivityPub } from "./server/activitypub";
import type { APEnv } from "./server/activitypub";
import { NoteStatsService } from "./services/NoteStatsService";
import { ThreadStatsService } from "./services/ThreadStatsService";


async function main() {
  console.log("🚀 Starting backend…");


  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

  const {
    DOMAIN,
    DB_URL,
    DB_NAME,
    USE_HTTPS,
    KEY_PATH,
    CERT_PATH,
    CA_PATH,
    PORT_HTTP,
    PORT_HTTPS
  } = process.env;

  if (!DB_URL || !DB_NAME) {
    throw new Error("DB_URL and DB_NAME must be set in .env");
  }

  // ----------------------------
  // 📌 Connect MongoDB
  // ----------------------------

  const { client, db } = await connectWithRetry({
    url: DB_URL,
    dbName: DB_NAME,
    retries: 3,
    delayMs: 5000,
  });

  
  
  // ----------------------------
  // 📌 Connect Postgres
  // ----------------------------
  const pgPool = new Pool({
    host: process.env.PG_HOST || "localhost",
    port: Number(process.env.PG_PORT) || 5432,
    user: process.env.PG_USER || "dojo",
    password: process.env.PG_PASSWORD || "dojo",
    database: process.env.PG_DB || "dojo",
  });

  await pgPool.query("SELECT 1"); // sanity check
  console.log("✅ [Postgres] Connected successfully");

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS note_stats (
      note_id TEXT PRIMARY KEY,
      replies INTEGER NOT NULL DEFAULT 0,
      ups INTEGER NOT NULL DEFAULT 0,
      downs INTEGER NOT NULL DEFAULT 0
    );
  `);
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS groups (
      id SERIAL PRIMARY KEY,

      group_iri TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,

      is_public BOOLEAN NOT NULL DEFAULT TRUE,
      is_deleted BOOLEAN NOT NULL DEFAULT FALSE,

      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)
  
  // ----------------------------
  // 📌 Setup Express app
  // ----------------------------
  const app = express();


  
  
  app.use(cookieParser());
  app.use(express.json());

  // ----------------------------
  // 📌 Setup ActivityPub (apex)
  // ----------------------------
  console.log("📡 Initializing ActivityPub…");
  
  const apex = await setupActivityPub(app, process.env as unknown as APEnv, db);
  
  // ----------------------------
  // 📌 Instantiate Services
  // ----------------------------
  const authService = new AuthService(db);
  const activityPubService = new ActivityPubService(apex, db);
  const noteStatsService = new NoteStatsService(pgPool);
  const threadStatsService = new ThreadStatsService(pgPool);
  const userService = new UserService(db);
  
  
  // ----------------------------
  // 📌 Mount Routes
  // ----------------------------
  app.use("/api/auth", authRoutes(authService, userService,activityPubService));
  app.use("/api", postRoutes(authService, userService, activityPubService,noteStatsService, threadStatsService));
  app.use("/api", publicRoutes(db, apex));

  // ----------------------------
  // 📌 Static files (optional)
  // ----------------------------
  app.use("/f", express.static("public/files"));

  // ----------------------------
  // 📌 Start HTTP or HTTPS server
  // ----------------------------
  const useHttps = USE_HTTPS === "true";
  let server: http.Server | https.Server;

  if (useHttps) {
    console.log("🔐 HTTPS enabled");

    const ssl = {
      key: KEY_PATH && fs.readFileSync(path.join(process.cwd(), KEY_PATH)),
      cert: CERT_PATH && fs.readFileSync(path.join(process.cwd(), CERT_PATH)),
      ca: CA_PATH && fs.readFileSync(path.join(process.cwd(), CA_PATH))
    };

    server = https.createServer(ssl, app);
  } else {
    console.log("🌐 HTTP enabled");
    server = http.createServer(app);
  }

  const port = useHttps ? Number(PORT_HTTPS) : Number(PORT_HTTP) || 3000;

  server.listen(port, () => {
    console.log(`✅ Server running on ${useHttps ? "https" : "http"}://${DOMAIN}:${port}`);
  });

  // ----------------------------
  // 📌 Graceful Shutdown
  // ----------------------------
  onShutdown(async () => {
    console.log("🔻 Shutting down backend…");
    await new Promise((resolve) => server.close(resolve));
    await client.close();
    console.log("👋 Goodbye.");
  });
}

main().catch((err) => {
  console.error("❌ Fatal startup error:", err);
  process.exit(1);
});

interface ConnectWithRetryOptions {
  url: string;
  dbName: string;
  retries?: number;
  delayMs?: number;
}

interface ConnectWithRetryResult {
  client: MongoClient;
  db: Db;
}

export async function connectWithRetry({
  url,
  dbName,
  retries = 3,
  delayMs = 5000,
}: ConnectWithRetryOptions): Promise<ConnectWithRetryResult> {
  let attempt = 0;

  while (attempt < retries) {
    attempt++;

    console.log(
      `🗄️  [MongoDB] Attempt ${attempt}/${retries} — connecting to ${url} ...`
    );

    try {
      const client = new MongoClient(url);
      await client.connect();

      console.log(
        `✅ [MongoDB] Connected successfully on attempt ${attempt}`
      );

      const db = client.db(dbName);
      return { client, db };
    } catch (err: any) {
      console.error(`❌ [MongoDB] Connection failed on attempt ${attempt}`);
      console.error(`   Error: ${err.message}`);

      if (attempt >= retries) {
        console.error("💥 [MongoDB] All retry attempts failed. Giving up.");
        throw err;
      }

      console.log(
        `⏳ [MongoDB] Retrying in ${delayMs / 1000} seconds...\n`
      );

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  // Should never reach here, but TS requires a return or throw.
  throw new Error("Unexpected error in connectWithRetry()");
}
