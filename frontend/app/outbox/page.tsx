"use client";

import { useEffect, useState } from "react";
import { useMe } from "../hooks/me";
import { getActor, iriFromValue } from "../services/threadService";
import { log } from "console";

/**
 * TimelineItem represents a single ActivityPub activity
 * normalized for UI display.
 *
 * This is intentionally an *event* view (Create, Add, etc),
 * not a flattened "post" model.
 */
type TimelineItem = {
  id: string;               // activity IRI
  activityType: string;     // Create, Add, Update, etc
  objectType: string;       // Note, Person, Add, Unknown
  content: string | null;   // human-readable content (if any)
  published?: string;       // activity timestamp
  object: string | null;    // object IRI (for Add, etc)
  target: string | null;    // target IRI (for Add, etc)
};

export default function Home() {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const { data: user, isLoading } = useMe();

  /**
   * Normalize a raw ActivityPub activity into a
   * UI-friendly TimelineItem.
   *
   * This intentionally preserves activity semantics
   * rather than collapsing everything into "posts".
   */
  function normalizeActivity(activity: any): TimelineItem {
    const object =
      typeof activity.object === "object" ? activity.object : null;

    return {
      id: object.id,
      activityType: activity.type,
      objectType: object?.type ?? "Unknown",
      content: object?.content ?? null,
      published: activity.published,
      object: object?.object ?? null,
      target: object?.target ?? null,
    };
  }

  /**
   * Load the current actor's outbox and render it
   * as a local activity timeline.
  */
 async function loadOutboxStream() {

  if(!user || !user.actorId){
      console.error("No user logged in");
      return;
    } 
    
    try {
      //FETCH DATA
      const actor = await getActor(user?.actorId);
      if(!actor){
        console.error("getActor failed");
        return;
      }

      const outboxIri = iriFromValue(actor.outbox);

      if(!outboxIri) return;
      const res = await fetch(outboxIri, {
        headers:{
          Accept: "Application/activity+json"
        }
      });

      if (!res.ok) {
        console.error("Failed to load outbox");
        return;
      }

      const outbox = await res.json();
      const firstPage = iriFromValue(outbox.first);

      if(!firstPage) return;
      const pageRes = await fetch(firstPage, {
        headers: {
          Accept: "application/activity+json",
        },
      });

      //DATA FETCHED
      const pageData = await pageRes.json();

      //NORMALIZE DATA
      const normalized =
        (pageData.orderedItems || []).map(normalizeActivity);

      //SET AND RENDER
      setItems(normalized);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    if (user) {
      loadOutboxStream();
    }
  }, [isLoading, user]);

  /**
   * Render the primary human-readable line
   * for an activity.
   */
  const showContent = (item: TimelineItem) => {
    if (item.content) {
      return (
        <div className="text-base leading-relaxed">
          {item.content}
        </div>
      );
    }

    if (item.objectType === "Add" && item.object && item.target) {
      return (
        <div className="text-base leading-relaxed">
          {item.object} was added to {item.target}
        </div>
      );
    }

    return (
      <div className="text-sm italic text-zinc-400">
        (no human-readable content)
      </div>
    );
  };

  return (
    <div className="flex items-center justify-center bg-zinc-100 dark:bg-black p-5">
      <div className="w-full max-w-xl flex flex-col gap-3">
        {/* Outbox timeline */}
            <div className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
            Outbox
            </div>

        <div className="flex flex-col gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-black dark:text-white"
            >
              {/* Activity header */}
              <div className="text-xs text-zinc-500 mb-1">
                {item.activityType} · {item.objectType}
                {item.published && (
                  <> · {new Date(item.published).toLocaleString()}</>
                )}{" "}
                · {item.id}
              </div>

              {/* Activity body */}
              {showContent(item)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
