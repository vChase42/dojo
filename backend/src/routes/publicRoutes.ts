// src/routes/publicRoutes.ts

import { Router } from "express";

export function publicRoutes(db: any, apex: any) {
  const router = Router();

  // List top groups by announce count
  router.get("/groups", async (req, res) => {
    try {
      const groups = await db.collection("streams")
        .aggregate([
          { $sort: { _id: -1 } },
          { $limit: 10000 },
          { $match: { type: "Announce" } },
          { $group: { _id: "$actor", postCount: { $sum: 1 } } },
          {
            $lookup: {
              from: "objects",
              localField: "_id",
              foreignField: "id",
              as: "actor",
            },
          },
          {
            $replaceRoot: {
              newRoot: {
                $mergeObjects: [{ $arrayElemAt: ["$actor", 0] }, "$$ROOT"],
              },
            },
          },
          { $project: { _id: 0, _meta: 0, actor: 0 } },
        ])
        .sort({ postCount: -1 })
        .limit(Number.parseInt(req.query.n as string) || 50)
        .toArray();

      res.json(
        apex.toJSONLD({
          id: `https://${process.env.DOMAIN}/groups`,
          type: "OrderedCollection",
          totalItems: groups.length,
          orderedItems: groups,
        })
      );
    } catch (err: any) {
      console.error(err);
      res.status(500).send("Server error");
    }
  });

  // Stats endpoint
  router.get("/stats", async (req, res) => {
    try {
      const queueSize = await db
        .collection("deliveryQueue")
        .countDocuments({ attempt: 0 });

      const uptime = process.uptime();

      res.json({ queueSize, uptime });
    } catch (err) {
      res.status(500).send("Server error");
    }
  });

  return router;
}
