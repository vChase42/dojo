// src/services/activitypubService.ts
import { UserRecord } from "./userService";

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

  async createGroup(
    groupName: string,
    options?: {
      summary?: string;
      iconUrl?: string;
      discoverable?: boolean;
    }
  ): Promise<{ groupId: string }> {
    const {
      summary = `Group about ${groupName}`,
      iconUrl,
      discoverable = true,
    } = options ?? {};

    const groupId = this.apex.utils.usernameToIRI(groupName);

    // Prevent accidental overwrite
    const existing = await this.apex.store.getObject(groupId);
    if (existing) {
      throw new Error(`Group already exists: ${groupName}`);
    }

    const group: any = {
      "@context": "https://www.w3.org/ns/activitystreams",
      id: groupId,
      type: "Group",
      preferredUsername: groupName,
      name: groupName,
      summary,
      inbox: `${groupId}/inbox`,
      outbox: `${groupId}/outbox`,
      followers: `${groupId}/followers`,
      to: ["https://www.w3.org/ns/activitystreams#Public"],
    };

    if (iconUrl) {
      group.icon = {
        type: "Image",
        mediaType: "image/png",
        url: iconUrl,
      };
    }

    // Optional local-only metadata (safe on actors)
    if (discoverable) {
      group._meta = { discoverable: true };
    }

    await this.apex.store.saveObject(group, null, true);

    return { groupId };
  }


  async createNote(
    actorId: string,
    content: string,
    context: string,
    options: {
      inReplyTo?: string;
      to?: string[];
      cc?: string[];
      published?: string;
    }
  ): Promise<{ noteId: string; activityId?: string }> {
    if (!context) {
      throw new Error("context is required to create a post");
    }

    const note: any = {
      "@context": "https://www.w3.org/ns/activitystreams",
      type: "Note",
      attributedTo: actorId,
      content,
      context,
      to: options.to?.length
        ? options.to
        : ["https://www.w3.org/ns/activitystreams#Public"],
    };

    if (options.cc?.length) note.cc = options.cc;
    if (options.inReplyTo) note.inReplyTo = options.inReplyTo;
    if (options.published) note.published = options.published;

    const { activityId } = await this.submitActivity(
      actorId,
      note,
      "Create Note"
    );

    const activity = activityId
      ? await this.apex.store.getActivity(activityId)
      : null;

    return {
      noteId:
        activity?.object?.[0]?.id ??
        activity?.object?.id ??
        "",
      activityId,
    };
  }

  async getPost(id: string){
    return this.apex.store.getObject(id);
  }

  async getWall(user: UserRecord, page?: number) {
    const actor = await this.apex.store.getObject(user.actorId);
    // const outbox = await this.apex.getOutbox(actor, 0, true);

    //filter the above out and return it later! Then postcontroller will spice the the with reply and like stats.
    return this.apex.getOutbox(actor, page, true);
  }

  async getActor(actorId: string){
    return await this.apex.store.getObject(actorId);
  }

  private async submitActivity(
    actorId: string,
    activity: any,
    errorLabel = "Activity"
  ): Promise<{ activityId?: string }> {
    const response = await fetch(`${actorId}/outbox`, {
      method: "POST",
      headers: {
        "Content-Type": "application/activity+json",
        Authorization: `Bearer ${process.env.ADMIN_SECRET}`,
      },
      body: JSON.stringify(activity),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Outbox rejected ${errorLabel}: ${errText}`);
    }

    return {
      activityId: response.headers.get("location") ?? undefined,
    };
  }



}
