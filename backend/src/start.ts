import "dotenv/config";
import http from "http";
import https from "https";
import fs from "fs";
import path from "path";
import { Db, MongoClient } from "mongodb";
import { Pool } from "pg";
import { onShutdown } from "node-graceful-shutdown";

import { createApplication } from "./bootstrap/application";

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
    PORT_HTTPS,
  } = process.env;

  if (!DB_URL || !DB_NAME) {
    throw new Error("DB_URL and DB_NAME must be set in .env");
  }

  // ---------------------------------------------------------------------------
  // MongoDB
  // ---------------------------------------------------------------------------

  const { client, db } = await connectWithRetry({
    url: DB_URL,
    dbName: DB_NAME,
    retries: 3,
    delayMs: 5000,
  });

  // ---------------------------------------------------------------------------
  // Postgres
  // ---------------------------------------------------------------------------

  const pg = new Pool({
    host: process.env.PG_HOST || "localhost",
    port: Number(process.env.PG_PORT) || 5432,
    user: process.env.PG_USER || "dojo",
    password: process.env.PG_PASSWORD || "dojo",
    database: process.env.PG_DB || "dojo",
  });

  await pg.query("SELECT 1");

  console.log("✅ [Postgres] Connected successfully");

  // ---------------------------------------------------------------------------
  // Application
  // ---------------------------------------------------------------------------

  console.log("📡 Initializing application…");

  const { app } = await createApplication(db, pg);

  // ---------------------------------------------------------------------------
  // HTTP / HTTPS
  // ---------------------------------------------------------------------------

  const useHttps = USE_HTTPS === "true";

  let server: http.Server | https.Server;

  if (useHttps) {
    console.log("🔐 HTTPS enabled");

    server = https.createServer(
      {
        key: KEY_PATH && fs.readFileSync(path.join(process.cwd(), KEY_PATH)),
        cert: CERT_PATH && fs.readFileSync(path.join(process.cwd(), CERT_PATH)),
        ca: CA_PATH && fs.readFileSync(path.join(process.cwd(), CA_PATH)),
      },
      app
    );
  } else {
    console.log("🌐 HTTP enabled");

    server = http.createServer(app);
  }

  const port =
    useHttps
      ? Number(PORT_HTTPS)
      : Number(PORT_HTTP) || 3000;

  server.listen(port, () => {
    console.log(
      `✅ Server running on ${useHttps ? "https" : "http"}://${DOMAIN}:${port}`
    );
  });

  // ---------------------------------------------------------------------------
  // Shutdown
  // ---------------------------------------------------------------------------

  onShutdown(async () => {
    console.log("🔻 Shutting down backend…");

    await new Promise((resolve) => server.close(resolve));

    await pg.end();
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
      `🗄️ [MongoDB] Attempt ${attempt}/${retries} — connecting to ${url}...`
    );

    try {
      const client = new MongoClient(url);

      await client.connect();

      console.log(
        `✅ [MongoDB] Connected successfully on attempt ${attempt}`
      );

      return {
        client,
        db: client.db(dbName),
      };
    } catch (err: any) {
      console.error(
        `❌ [MongoDB] Connection failed on attempt ${attempt}`
      );
      console.error(`   Error: ${err.message}`);

      if (attempt >= retries) {
        console.error("💥 [MongoDB] All retry attempts failed.");
        throw err;
      }

      console.log(
        `⏳ [MongoDB] Retrying in ${delayMs / 1000} seconds...\n`
      );

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error("Unexpected error in connectWithRetry()");
}