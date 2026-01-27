// src/server/activitypub.ts
import { Application } from "express";
// Force TS to treat it as any
const ActivitypubExpress = require("activitypub-express") as any;
import express from "express";

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
    group: "/g/:group",
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

  async function actorOnDemand(req: any, res:any , next:any) {
    const isUser = !!req.params.actor;
    const isGroup = !!req.params.group;

    if (isUser) {
      // NEVER auto-create Person actors
      return next();
    }

    if (!isGroup) {
      return next();
    }

    const groupName = req.params.group;
    const actorIRI = apex.utils.usernameToIRI(groupName);

    try {
      const existing = await apex.store.getObject(actorIRI);
      if (!existing) {
        console.log(`Creating group actor: ${groupName}`);

        const group = await createActor(
          groupName,
          `${groupName} group`,
          `Group about ${groupName}`,
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
  /** Apply local Add activities to thread collections */
app.on("apex-outbox" as any, async ({ actor, activity }: any) => {

  if (activity.type !== "Create") return;

  const inner = activity.object?.[0];
  if (!inner || inner.type?.toLowerCase() !== "add") return;

  const target =
    inner.target?.[0] ??
    inner.target;

  const object =
    inner.object?.[0] ??
    inner.object;

  if (
    typeof target !== "string" ||
    !target.startsWith(`https://${DOMAIN}/t/`)
  ) {
    return;
  }

  const noteIri =
    typeof object === "string"
      ? object
      : object.id;

  if (!noteIri) return;

  const thread = await apex.store.getObject(target);
  if (!thread || thread.type !== "OrderedCollection") return;

  thread.orderedItems = thread.orderedItems || [];

  if (!thread.orderedItems.includes(noteIri)) {
    thread.orderedItems.unshift(noteIri);
    thread.totalItems = (thread.totalItems || 0) + 1;
    await apex.store.updateObject(thread, inner.attributedTo, true);
  }
});


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
      case "add": {
        const target = activity.target?.[0] || activity.target;
        const object = activity.object?.[0] || activity.object;

        if (!target || !object) return;

        // Only allow local thread collections
        if (!target.startsWith(`https://${DOMAIN}/t/`)) return;

        const thread = await apex.store.getObject(target);
        if (!thread || thread.type !== "OrderedCollection") return;

        thread.orderedItems = thread.orderedItems || [];

        if (!thread.orderedItems.includes(object.id ?? object)) {
          thread.orderedItems.unshift(object.id ?? object);
          thread.totalItems = (thread.totalItems || 0) + 1;
          await apex.store.saveObject(thread);
        }

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
  app.get(routes.group, actorOnDemand, apex.net.actor.get);
  app.get(routes.followers, actorOnDemand, apex.net.followers.get);
  app.get(routes.following, actorOnDemand, apex.net.following.get);
  app.get(routes.liked, actorOnDemand, apex.net.liked.get);
  app.get(routes.object, apex.net.object.get);
  app.get(routes.activity, apex.net.activityStream.get);
  app.get(routes.shares, apex.net.shares.get);
  app.get(routes.likes, apex.net.likes.get);
app.get("/t/:id", async (req, res) => {
  const { id } = req.params;
  const page = req.query.page;

  const threadIri = `https://${DOMAIN}/t/${id}`;

  // Fetch thread object
  const thread = await apex.store.getObject(threadIri);
  if (!thread) {
    return res.status(404).json({ error: "Thread not found" });
  }

  // Paging requested → OrderedCollectionPage
  if (page) {
    const pageNum = Number(page) || 1;
    const PAGE_SIZE = 20;

    const ids = thread.orderedItems || [];

    const pageItems = ids.slice(
      (pageNum - 1) * PAGE_SIZE,
      pageNum * PAGE_SIZE
    );

    const notes = await db
      .collection("objects")
      .find({ id: { $in: pageItems } })
      .toArray();

    return res.json({
      "@context": "https://www.w3.org/ns/activitystreams",
      id: `${threadIri}?page=${pageNum}`,
      type: "OrderedCollectionPage",
      partOf: threadIri,
      orderedItems: notes.map((n:any) => n.id),
      next: notes.length === PAGE_SIZE
        ? `${threadIri}?page=${pageNum + 1}`
        : undefined,
    });
  }

  // No paging → OrderedCollection metadata
  return res.json({
    "@context": "https://www.w3.org/ns/activitystreams",
    id: threadIri,
    type: "OrderedCollection",
    name: thread.name,
    totalItems: await db.collection("objects").countDocuments({
      type: "Note",
      context: threadIri,
    }),
    first: `${threadIri}?page=1`,
  });
});

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
