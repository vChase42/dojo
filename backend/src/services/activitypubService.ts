// src/services/activitypubService.ts

export class ActivityPubService {
  public apex: any;
  public mdb: any;

  constructor(apex: any, mdb: any) {
    this.apex = apex;
    this.mdb = mdb;
  }


  async createPersonActor(username: string, displayName?: string) {
    const actorIRI = this.apex.utils.usernameToIRI(username);

    // Safety: never overwrite an existing actor
    const existing = await this.apex.store.getObject(actorIRI);
    if (existing) {
      return existing.id;
    }

    const actor = await this.apex.createActor(
      username,                         // preferredUsername
      displayName || username,          // name
      `User ${username}`,               // summary
      {
        type: "Image",
        mediaType: "image/jpeg",
        url: `https://${this.apex.domain}/f/dojo.png`,
      },
      "Person"                          
    );

    await this.apex.store.saveObject(actor);
    return actor.id;
  }

  async createThread(
    createdBy: string,
    options: {
      title: string;
      slug?: string;        // optional human-readable id
      published?: string;   // for ingestion / backfill
    }
  ): Promise<{ threadId: string }> {
    const { title, slug, published } = options;

    if (!title || typeof title !== "string") {
      throw new Error("Thread title is required");
    }

    // Generate a stable thread ID
    const idPart = slug ?? crypto.randomUUID();
    const threadId = `https://${this.apex.domain}/t/${idPart}`;

    // Safety: never overwrite an existing thread
    const existing = await this.apex.store.getObject(threadId);
    if (existing) {
      throw new Error("Thread already exists");
    }

    const thread = {
      "@context": "https://www.w3.org/ns/activitystreams",
      id: threadId,
      type: "OrderedCollection",
      name: title,
      attributedTo: createdBy,
      slug: idPart,
      orderedItems: [],
      totalItems: 0,
      first: `${threadId}?page=1`,
      published: published ?? new Date().toISOString(),
    };

    await this.apex.store.saveObject(thread);

    return { threadId };
  }



  async createPost(actorId: string,content: string, context: string, options: { inReplyTo?: string;  to?: string[];  cc?: string[];  published?: string;}
  ): Promise<{ noteId: string; activityId?: string }> {
    const { inReplyTo,  to,  cc,  published,} = options;

    if (!context) {
      throw new Error("context is required to create a post");
    }

    const outboxUrl = `${actorId}/outbox`;

    const note: any = {
      "@context": "https://www.w3.org/ns/activitystreams",
      type: "Note",
      attributedTo: actorId,
      content,
      context: context,
      to: to?.length ? to : ["https://www.w3.org/ns/activitystreams#Public"],
    };

    if (cc?.length) {
      note.cc = cc;
    }

    if (inReplyTo) {
      note.inReplyTo = inReplyTo;
    }

    if (published) {
      note.published = published;
    }

    const response = await fetch(outboxUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/activity+json",
        "Authorization": `Bearer ${process.env.ADMIN_SECRET}`,
      },
      body: JSON.stringify(note),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Outbox rejected post: ${errText}`);
    }

    const activityId = response.headers.get("location") ?? undefined;
    const activity = activityId
      ? await this.apex.store.getActivity(activityId)
      : null;
    
    const noteId =
      activity?.object?.[0]?.id ??
      activity?.object?.id ??
      undefined;    
    return {
      noteId: noteId ?? "",
      activityId,
 };
}

  async getCollection(idOrIri: string) {
    const iri = idOrIri.startsWith("http")
      ? idOrIri
      : `https://${this.apex.domain}/t/${idOrIri}`;

    return this.apex.store.getObject(iri);
  }

  async getThreads(limit = 50) {
    return this.mdb
      .collection("objects")
      .find({ type: "OrderedCollection" })
      .sort({ published: -1 })
      .limit(limit)
      .toArray();
  }

async addNoteToOrderedCollection(
  actorId: string,
  threadIri: string,
  noteIri: string
) {
  const outboxUrl = `${actorId}/outbox`;

  const addActivity = {
    "@context": "https://www.w3.org/ns/activitystreams",
    type: "Add",
    attributedTo: actorId,
    object: noteIri,
    target: threadIri,
    to: ["https://www.w3.org/ns/activitystreams#Public"],
  };

  const response = await fetch(outboxUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/activity+json",
      "Authorization": `Bearer ${process.env.ADMIN_SECRET}`,
    },
    body: JSON.stringify(addActivity),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Outbox rejected Add: ${errText}`);
  }

  const activityId = response.headers.get("location") ?? undefined;

  return { activityId };
}

  async getOutbox(actor: any, page?: number) {
    // console.log(actor);
    const actorNew = await this.apex.store.getObject(actor.actorId);
    // console.log(actorNew);
    return this.apex.getOutbox(actorNew, page, true);
  }

  async getActor(actorId: string){
    return await this.apex.store.getObject(actorId);
  }

}
