// src/server/activitypub.ts
import { Application } from "express";
// Force TS to treat it as any
const ActivitypubExpress = require("activitypub-express") as any;
import express from "express";

import path from "path";
import fs from "fs";

export interface APEnv {
  DOMAIN: string;
  KEY_PATH?: string;
  CERT_PATH?: string;
  CA_PATH?: string;
  USE_ATTACHMENTS?: string;
}

export async function setupActivityPub(app: Application, env: APEnv, db: any) {
  const {
    DOMAIN,
    KEY_PATH,
    CERT_PATH,
    CA_PATH,
    USE_ATTACHMENTS
  } = env;

  const icon = {
    type: "Image",
    mediaType: "image/jpeg",
    url: `https://${DOMAIN}/f/dojo.png`,
  };

  // Define AP routes
  const routes = {
    actor: "/u/:actor",
    object: "/o/:id",
    activity: "/s/:id",
    inbox: "/u/:actor/inbox",
    outbox: "/u/:actor/outbox",
    followers: "/u/:actor/followers",
    following: "/u/:actor/following",
    liked: "/u/:actor/liked",
    collections: "/u/:actor/c/:id",
    blocked: "/u/:actor/blocked",
    rejections: "/u/:actor/rejections",
    rejected: "/u/:actor/rejected",
    shares: "/s/:id/shares",
    likes: "/s/:id/likes",
  };

  const apex = ActivitypubExpress({
    name: "Dojo",
    version: "1.0.0",
    domain: DOMAIN,
    actorParam: "actor",
    objectParam: "id",
    itemsPerPage: 100,
    offlineMode: process.env.NODE_ENV === "production",
    context: require("../../data/context.json"),
    routes,
  });

  apex.store.db = db;
  await apex.store.setup();

  app.use(
    express.json({ type: apex.consts.jsonldTypes }),
    express.urlencoded({ extended: true })
  );
  // Attach apex to Express
  app.use(
    apex,
    function checkAdminKey(req, res, next) {
      if (
        process.env.ADMIN_SECRET &&
        req.get("authorization") === `Bearer ${process.env.ADMIN_SECRET}`
      ) {
        res.locals.apex.authorized = true;
      }
      next();
    }
  );

  /** Create group actors on demand */
  async function createActor(...args: any[]) {
    const actor = await apex.createActor(...args);
    if (USE_ATTACHMENTS) {
      actor.attachment = require("../../data/attachments.json");
    }
    return actor;
  }

  async function actorOnDemand(req: any, res: any, next: any) {
    const actor = req.params.actor;
    if (!actor) return next();

    const actorIRI = apex.utils.usernameToIRI(actor);

    try {
      if (!(await apex.store.getObject(actorIRI)) && actor.length <= 255) {
        console.log(`Creating group: ${actor}`);

        const summary = `I'm a group about ${actor}. Follow for updates.`;

        const group = await createActor(
          actor,
          `${actor} group`,
          summary,
          icon,
          "Group"
        );

        await apex.store.saveObject(group);
      }
    } catch (err) {
      return next(err);
    }

    next();
  }

  /** Inbox filter + logger */
  const acceptablePublicActivities = ["delete", "update"];

  apex.net.inbox.post.splice(
    apex.net.inbox.post.indexOf(apex.net.validators.jsonld) + 1,
    0,

    function inboxLogger(req:any, res:any, next:any) {
      try {
        console.log(
          "%s from %s to %s",
          req.body.type,
          req.body.actor?.[0],
          req.params[apex.actorParam]
        );
      } finally {
        next();
      }
    },

    function inboxFilter(req:any, res:any, next:any) {
      try {
        const groupIRI = apex.utils.usernameToIRI(req.params[apex.actorParam]);
        const audience = apex.audienceFromActivity(req.body);
        const activityType = req.body.type?.toLowerCase();
        const object = req.body.object?.[0];

        const irrelevant =
          !audience.includes(groupIRI) &&
          object !== groupIRI &&
          !acceptablePublicActivities.includes(activityType);

        if (irrelevant) {
          console.log("Ignoring irrelevant activity:", req.body);
          return res.status(202).send("Ignored");
        }
      } catch (err) {
        console.warn("Inbox filter error:", err);
      }
      next();
    }
  );

  /** Auto accept follows & auto announce */
  app.on("apex-inbox" as any, async ({ actor, activity, recipient }: any) => {
    switch (activity.type.toLowerCase()) {
      case "create": {
        const to = [recipient.followers[0], apex.consts.publicAddress];
        const share = await apex.buildActivity("Announce", recipient.id, to, {
          object: activity.object[0].id,
          cc: actor.id,
        });
        apex.addToOutbox(recipient, share);
        break;
      }

      case "follow": {
        const accept = await apex.buildActivity(
          "Accept",
          recipient.id,
          actor.id,
          { object: activity.id }
        );

        const { postTask } = await apex.acceptFollow(recipient, activity);
        await apex.addToOutbox(recipient, accept);

        return postTask();
      }
    }
  });

  /** Register AP routes */
  app.route(routes.inbox)
    .post(actorOnDemand, apex.net.inbox.post)
    .get(actorOnDemand, apex.net.inbox.get);

  const outboxPostPipeline = apex.net.outbox.post;

  // Only insert if missing
  if (!outboxPostPipeline.includes(apex.net.validators.jsonld)) {
    outboxPostPipeline.unshift(apex.net.validators.jsonld);
  }

  
  app.route(routes.outbox)
    .get(actorOnDemand, apex.net.outbox.get)
    .post(apex.net.outbox.post); // ⚠️ WILL BE RESTRICTED LATER BY AUTH WRAPPER

  app.get(routes.actor, actorOnDemand, apex.net.actor.get);
  app.get(routes.followers, actorOnDemand, apex.net.followers.get);
  app.get(routes.following, actorOnDemand, apex.net.following.get);
  app.get(routes.liked, actorOnDemand, apex.net.liked.get);
  app.get(routes.object, apex.net.object.get);
  app.get(routes.activity, apex.net.activityStream.get);
  app.get(routes.shares, apex.net.shares.get);
  app.get(routes.likes, apex.net.likes.get);

  app.get(
    "/.well-known/webfinger",
    apex.net.wellKnown.parseWebfinger,
    actorOnDemand,
    apex.net.validators.targetActor,
    apex.net.wellKnown.respondWebfinger
  );

  app.get("/.well-known/nodeinfo", apex.net.nodeInfoLocation.get);
  app.get("/nodeinfo/:version", apex.net.nodeInfo.get);

  return apex;
}
