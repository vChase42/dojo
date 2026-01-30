/*
translate this file into outbox style messaging.
then, what. i need to fix the getcollection logic in the backend to be essentially passthrough. should be fine.
refactor getcollection logic.
clean up frontend functions as per previous step. 

*/

"use client";

import { useEffect, useState } from "react";
import { useMe } from "./hooks/me";

type TimelineItem = {
  id: string;
  activityType: string;
  objectType: string;
  content: string | null;
  published?: string;
  object: string | null;
  target: string | null;
};

export default function Home() {
  const [posts, setPosts] = useState<TimelineItem[]>([]);
  const [text, setText] = useState("");
  const { data: user, isLoading } = useMe();

  function normalizeActivity(activity: any): TimelineItem {
    const object =
      typeof activity.object === "object" ? activity.object : null;

    return {
      id: activity.id,
      activityType: activity.type,
      objectType: object?.type ?? "Unknown",
      content: object?.content ?? null,
      published: activity.published,
      object: object?.object ?? null,
      target: object?.target ?? null,
    };
  }

  async function loadPosts() {
    try {
      const res = await fetch("/api/outbox", {
        credentials: "include",
      });

      if (!res.ok) {
        console.error("Failed to load posts");
        return;
      }

      const data = await res.json();
      const firstPage = data.collection.first[0];

      const pageRes = await fetch(firstPage, {
        headers: {
          Accept: "application/activity+json",
        },
      });

      const pageData = await pageRes.json();

      const normalized =
        (pageData.orderedItems || []).map(normalizeActivity);
      console.log(pageData);
      setPosts(normalized);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    if (user) {
      loadPosts();
    }
  }, [isLoading, user]);

  async function handleKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>
  ) {
    if (e.key !== "Enter" || text.trim() === "") return;

    try {
      const res = await fetch("/api/post", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: text,
          context: user!.actorId,
        }),
      });

      if (!res.ok) {
        console.error("Failed to create post");
        return;
      }

      setText("");
      loadPosts();
    } catch (err) {
      console.error(err);
    }
  }

  const showContent = (item: TimelineItem) => {
    if(item.content){
      return(
        <div className="text-base leading-relaxed">
          {item.content}
        </div>
      )

    }

    if(item.objectType == "Add" && item.object && item.target){
      return (
        <div className="text-base leading-relaxed">
          {item.object} has been added to {item.target}  
        </div>
      )
    }
    return (
        <div className="text-sm italic text-zinc-400">
          (no content)
        </div>
    );
  }

  return (
    <div className="flex items-center justify-center bg-zinc-100 dark:bg-black p-6">
      <div className="w-full max-w-xl flex flex-col gap-6">
        {/* Composer */}
        <input
          className="w-full p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Write a post and hit Enter..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
        />

        {/* Timeline */}
        <div className="flex flex-col gap-4">
          {posts.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-black dark:text-white"
            >
              <div className="text-xs text-zinc-500 mb-1">
                {item.activityType} · {item.objectType}
                {item.published && (
                  <> · {new Date(item.published).toLocaleString()}</>
                )} · {item.id}

              </div>

              {showContent(item)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
