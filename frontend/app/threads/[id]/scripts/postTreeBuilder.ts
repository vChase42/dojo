import { Post } from "@/app/services/threadService";

export type PostTreeNode = Post & {
  children: PostTreeNode[];
};


export function postTreeBuilder(posts: Post[]): PostTreeNode[] {
  const map: Record<string, PostTreeNode> = {};
  const roots: PostTreeNode[] = [];

  // 1. Initialize map
  for (const post of posts) {
    map[post.id] = {
      ...post,
      children: [],
    };
  }

  // 2. Link children → parents
  for (const post of posts) {
    if (post.inReplyTo && map[post.inReplyTo]) {
      map[post.inReplyTo].children.push(map[post.id]);
    } else {
      // no parent → root post
      roots.push(map[post.id]);
    }
  }

  // 3. Optional: sort by created time (oldest first)
  const sortRecursively = (nodes: PostTreeNode[]) => {
    nodes.sort((a, b) => {
      if (!a.created || !b.created) return 0;
      return new Date(a.created).getTime() - new Date(b.created).getTime();
    });
    nodes.forEach((n) => sortRecursively(n.children));
  };

  sortRecursively(roots);

  return roots;
}
