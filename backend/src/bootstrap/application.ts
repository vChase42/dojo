// src/bootstrap/application.ts

import express from "express";
import cookieParser from "cookie-parser";
import { Db } from "mongodb";
import { Pool } from "pg";

import { setupActivityPub } from "../activitypub/activitypub";
import type { APEnv } from "../activitypub/activitypub";

// Services
import { AuthService } from "../services/authService";
import { UserService } from "../services/userService";
import { ActivityPubService } from "../services/activitypubService";
import { PostsService } from "../services/postsService";
import { ThreadService } from "../services/threadService";
import { ForumService } from "../services/forumService";

// Routes
import { authRoutes } from "../routes/authRoutes";
import { postRoutes } from "../routes/postRoutes";
import { publicRoutes } from "../routes/publicRoutes";

// Conversation
import { ThreadSnapshotService } from "../conversation/core/threadSnapshotService";
import { ObservationRepository } from "../conversation/persistence/observationRepository";
import { ObservationSchema } from "../conversation/persistence/observationSchema";
import { AnalysisEngine } from "../conversation/engine/analysisEngine";
import { StructuralAnalyzer } from "../conversation/analyzers/structuralAnalyzer";

import { Pool as PgPool } from "pg";
import { createDevRoutes } from "../dev/routes";
import { DevController } from "../dev/controller";
import { EmbeddingSchema } from "../conversation/persistence/embeddings/EmbeddingSchema";
import { EmbeddingPostgresRepository } from "../conversation/persistence/embeddings/EmbeddingRepository";
import { SentenceTransformerModel } from "../conversation/persistence/embeddings/models/sentenceTransformerModel";

export interface Application {
  app: express.Express;

  services: {
    auth: AuthService;
    users: UserService;
    activityPub: ActivityPubService;
    posts: PostsService;
    threads: ThreadService;
    forum: ForumService;
  };

  conversation: {
    snapshot: ThreadSnapshotService;
    analysis: AnalysisEngine;

    analyzers: {
      structural: StructuralAnalyzer;
    };
  };
}

export async function createApplication(
  mongo: Db,
  pg: PgPool
): Promise<Application> {
  const app = express();

  app.use(cookieParser());
  app.use(express.json());

  // ---------------------------------------------------------------------------
  // ActivityPub
  // ---------------------------------------------------------------------------

  const apex = await setupActivityPub(
    app,
    process.env as unknown as APEnv,
    mongo
  );

  // ---------------------------------------------------------------------------
  // Services
  // ---------------------------------------------------------------------------

  const auth = new AuthService(mongo);
  const users = new UserService(mongo);

  const activityPub = new ActivityPubService(apex, mongo);

  const posts = new PostsService(pg);
  const threads = new ThreadService(pg);

  await posts.initialize();
  await threads.initialize();

  const forum = new ForumService(
    activityPub,
    posts,
    threads
  );

  // ---------------------------------------------------------------------------
  // Conversation
  // ---------------------------------------------------------------------------

  const observationSchema = new ObservationSchema(pg);
  await observationSchema.initialize();

  const embeddingSchema = new EmbeddingSchema(pg);
  await embeddingSchema.initialize();

  const observationRepository = new ObservationRepository(pg);
  const embeddingRepository = new EmbeddingPostgresRepository(pg);

  const modelTransformer = new SentenceTransformerModel("sentence-transformers/all-MiniLM-L6-v2");
  await modelTransformer.initialize();

  const snapshot =
    new ThreadSnapshotService(
      threads,
      posts
    );

  const analysis =
    new AnalysisEngine(
      snapshot,
      observationRepository,
      embeddingRepository,
      modelTransformer,
      pg
    );

  const analyzers = {
    structural: new StructuralAnalyzer(),
  };

  // ---------------------------------------------------------------------------
  // Dev routes
  // ---------------------------------------------------------------------------

  const devController = new DevController(snapshot, analysis, pg)
  app.use(
      "/api/dev",
      createDevRoutes(devController)
  );

  // ---------------------------------------------------------------------------
  // Routes
  // ---------------------------------------------------------------------------

  app.use(
    "/api/auth",
    authRoutes(
      auth,
      users,
      activityPub
    )
  );

  app.use(
    "/api",
    postRoutes(
      auth,
      users,
      activityPub,
      posts,
      threads,
      forum
    )
  );

  app.use(
    "/api",
    publicRoutes(
      auth,
      users,
      activityPub,
      posts,
      threads,
      forum
    )
  );

  app.use("/f", express.static("public/files"));

  return {
    app,

    services: {
      auth,
      users,
      activityPub,
      posts,
      threads,
      forum,
    },

    conversation: {
      snapshot,
      analysis,
      analyzers,
    },
  };
}