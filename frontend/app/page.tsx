"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [posts, setPosts] = useState<any[]>([]);
  const [text, setText] = useState("");

  // Load the logged-in user's outbox
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
      console.log(data);
      setPosts(data.items || []); // format from your backend
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    loadPosts();
  }, []);

  // Post on Enter
  async function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter" || text.trim() === "") return;

    try {
      const res = await fetch("/api/post", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
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

        {/* Posts */}
        <div className="flex flex-col gap-4">
          {posts.map((post: any) => (
            <div
              key={post.id}
              className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-black dark:text-white"
            >
              <div className="text-base leading-relaxed">
                {post.object[0].content[0]}
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
