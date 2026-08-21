import type {
  GraphPost,
  Observation,
  ObservationGraph,
  ObservationTreeNode,
} from "../../types";

type GraphDto = {
  threadId: string;
  nodes: GraphPost[];
  edges: {
    source: string;
    target: string;
  }[];
};

export function buildObservationGraph(
  graph: GraphDto,
  observations: Observation[]
): ObservationGraph {
  const posts = new Map<string, GraphPost>();

  for (const post of graph.nodes) {
    posts.set(post.id, post);
  }

  const observationsById = new Map<string, Observation[]>();

  for (const observation of observations) {
    const list = observationsById.get(observation.subject.id) ?? [];
    list.push(observation);
    observationsById.set(observation.subject.id, list);
  }

  const childrenByPost = new Map<string, GraphPost[]>();
  const hasParent = new Set<string>();

  for (const edge of graph.edges) {
    const parent = posts.get(edge.source);
    const child = posts.get(edge.target);

    if (!parent || !child) {
      continue;
    }

    const children = childrenByPost.get(parent.id) ?? [];
    children.push(child);
    childrenByPost.set(parent.id, children);

    hasParent.add(child.id);
  }

  const rootPosts = graph.nodes.filter(post => !hasParent.has(post.id));

  const root: ObservationTreeNode = {
    subject: {
      key: `thread:${graph.threadId}`,
      type: "thread",
      id: graph.threadId,
      observations: observationsById.get(graph.threadId) ?? [],
    },
    children: [],
  };

  for (const observation of observations) {
    if (observation.subject.type !== "participant") {
      continue;
    }

    const participantId = observation.subject.id;

    if (root.children.some(child => child.subject.id === participantId)) {
      continue;
    }

    root.children.push({
      subject: {
        key: `participant:${participantId}`,
        type: "participant",
        id: participantId,
        observations: observationsById.get(participantId) ?? [],
      },
      children: [],
    });
  }

  for (const post of rootPosts) {
    root.children.push(
      buildPostNode(
        post,
        posts,
        childrenByPost,
        observationsById
      )
    );
  }

  return {
    root,
    posts,
  };
}

function buildPostNode(
  post: GraphPost,
  posts: Map<string, GraphPost>,
  childrenByPost: Map<string, GraphPost[]>,
  observationsById: Map<string, Observation[]>
): ObservationTreeNode {
  const node: ObservationTreeNode = {
    subject: {
      key: `post:${post.id}`,
      type: "post",
      id: post.id,
      observations: observationsById.get(post.id) ?? [],
      renderPayload: post,
    },
    children: [],
  };

  const children = childrenByPost.get(post.id) ?? [];

  for (const child of children) {
    const edgeId = `${post.id}::${child.id}`;

    node.children.push({
      subject: {
        key: `edge:${edgeId}`,
        type: "edge",
        id: edgeId,
        observations: observationsById.get(edgeId) ?? [],
        renderPayload: {
          parentId: post.id,
          childId: child.id,
        },
      },
      children: [
        buildPostNode(
          child,
          posts,
          childrenByPost,
          observationsById
        ),
      ],
    });
  }

  return node;
}