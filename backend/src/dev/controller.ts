// src/conversation/dev/controller.ts

import { Pool } from "pg";
import { Request, Response } from "express";

import { Post } from "../types";

import { AnalysisEngine } from "../conversation/engine/analysisEngine";
import { ThreadSnapshotService } from "../conversation/core/threadSnapshotService";
import { PostgresObservationQuery } from "../conversation/persistence/postgresObservationQuery";
import { StructuralAnalyzer } from "../conversation/analyzers/structuralAnalyzer";

export class DevController {
  constructor(
    private readonly snapshots: ThreadSnapshotService,
    private readonly analysis: AnalysisEngine,
    private readonly pg: Pool
  ) {}

  async analyze(
    req: Request,
    res: Response
  ): Promise<void> {
    const { threadId } = req.body;

    if (!threadId) {
      res.status(400).json({
        error: "threadId is required",
      });

      return;
    }

    const snapshot = await this.snapshots.load(threadId);

    if (!snapshot) {
      res.sendStatus(404);
      return;
    }

    const observations = await this.analysis.analyze(
      threadId,
      [
        new StructuralAnalyzer(),
      ]
    );

    res.json({
      success: true,
      observations,
    });
  }

  async graph(
    req: Request,
    res: Response
  ): Promise<void> {
    const { threadId } = req.params;

    const snapshot = await this.snapshots.load(threadId);

    if (!snapshot) {
      res.sendStatus(404);
      return;
    }

    const observations =
      await new PostgresObservationQuery(
        this.pg,
        threadId
      ).list();

    const observationsBySubject =
      new Map<string, typeof observations>();

    for (const observation of observations) {
      const key =
        `${observation.subject.type}:${observation.subject.id}`;

      const list =
        observationsBySubject.get(key) ?? [];

      list.push(observation);

      observationsBySubject.set(key, list);
    }

    const nodes: any[] = [];
    const edges: any[] = [];

    const visit = (post: Post) => {
      const key = `post:${post.id}`;

      nodes.push({
        id: post.id,

        parentId: post.parentId,

        authorId: post.authorIri,
        createdAt: post.createdAt,

        body: post.content,

        observations: Object.fromEntries(
          (observationsBySubject.get(key) ?? []).map(o => [
            o.type,
            o.data,
          ])
        ),
      });

      if (post.parentId) {
        edges.push({
          source: post.parentId,
          target: post.id,
        });
      }

      const children =
        snapshot.childrenByParentId.get(post.id) ?? [];

      for (const child of children)
        visit(child);
    };

    visit(snapshot.rootPost);

    res.json({
      threadId,

      nodes,
      edges,

      observations,
    });
  }
}