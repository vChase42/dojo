import type {
  GraphPost,
  Observation,
  ObservationGraph,
  ObservationTreeNode,
  ObservationSubjectType,
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

  const observationsBySubject = new Map<
    ObservationSubjectType,
    Map<string, Observation[]>
  >();

  for (const observation of observations) {
    let byId = observationsBySubject.get(observation.subject.type);

    if (!byId) {
      byId = new Map();
      observationsBySubject.set(observation.subject.type, byId);
    }

    const list = byId.get(observation.subject.id) ?? [];
    list.push(observation);
    byId.set(observation.subject.id, list);
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
      observations:
        observationsBySubject.get("thread")?.get(graph.threadId) ?? [],
    },
    children: [],
  };

  const participants =
    observationsBySubject.get("participant") ?? new Map();

  for (const [participantId, observations] of participants) {
    root.children.push({
      subject: {
        key: `participant:${participantId}`,
        type: "participant",
        id: participantId,
        observations,
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
        observationsBySubject
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
  observationsBySubject: Map<ObservationSubjectType, Map<string, Observation[]>>
): ObservationTreeNode {
  const node: ObservationTreeNode = {
    subject: {
      key: `post:${post.id}`,
      type: "post",
      id: post.id,
      observations: observationsBySubject.get("post")?.get(post.id) ?? [],
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
        observations: observationsBySubject.get("edge")?.get(edgeId) ?? [],
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
          observationsBySubject
        ),
      ],
    });
  }

  return node;
}