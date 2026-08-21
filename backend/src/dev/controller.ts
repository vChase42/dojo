// src/conversation/dev/controller.ts

import { Pool } from "pg";
import { Request, Response } from "express";

import { Post } from "../types";

import { AnalysisEngine } from "../conversation/engine/analysisEngine";
import { ThreadSnapshotService } from "../conversation/core/threadSnapshotService";
import { PostgresObservationQuery } from "../conversation/persistence/postgresObservationQuery";

export class DevController {
  constructor(
    private readonly snapshots: ThreadSnapshotService,
    private readonly analysis: AnalysisEngine,
    private readonly pg: Pool
  ) {}

  async analyzers(req: Request, res: Response): Promise<void> {
    res.json(
      this.analysis.getAnalyzers().map(analyzer => ({
        id: analyzer.id,
        name: analyzer.id,
        observationTypes: analyzer.observationTypes,
      }))
    );
  }

  async rankers(req: Request, res: Response): Promise<void> {
    res.json(
      this.analysis.getRankers().map(ranker => ({
        id: ranker.id,
        name: ranker.id,
      }))
    );
  }

  async observationTypes(req: Request, res: Response): Promise<void> {
    res.json(this.analysis.getObservationTypes());
  }

async analyze(req: Request, res: Response): Promise<void> {
    const { threadId, analyzers } = req.body;

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
        analyzers ?? []
    );

    res.json({
        success: true,
        observations,
    });
}

async graph(req: Request, res: Response): Promise<void> {
    const threadId = req.query.threadId as string;

    const snapshot = await this.snapshots.load(threadId);

    if (!snapshot) {
        res.sendStatus(404);
        return;
    }

    const nodes: any[] = [];
    const edges: any[] = [];

    const visit = (post: Post) => {
        nodes.push({
            id: post.id,
            parentId: post.parentId,
            authorIri: post.authorIri,
            createdAt: post.createdAt,
            content: post.content,
        });

        if (post.parentId) {
            edges.push({
                source: post.parentId,
                target: post.id,
            });
        }

        const children =
            snapshot.childrenByParentId.get(post.id) ?? [];

        for (const child of children) {
            visit(child);
        }
    };

    visit(snapshot.rootPost);

    res.json({
        threadId,
        nodes,
        edges,
    });
}

async observations(
    req: Request,
    res: Response
): Promise<void> {
    const threadId = req.query.threadId as string;

    const analyzers =
        typeof req.query.analyzers === "string"
            ? req.query.analyzers.split(",")
            : [];

    const snapshot = await this.snapshots.load(threadId);

    if (!snapshot) {
        res.sendStatus(404);
        return;
    }

    let observations =
        await new PostgresObservationQuery(
            this.pg,
            threadId
        ).list();

    if (analyzers.length > 0) {
        observations = observations.filter(o =>
            analyzers.includes(o.analyzerId)
        );
    }

    res.json(observations);
}

}