import type { GraphPost } from "../../types";
import type { GraphNode, Observation } from "../../types";

type GraphDtoNode = {
  threadId: string;
  nodes: GraphPost[],
  edges: {
    source: string;
    target: string;
  }[],
};

export function buildTree(graph: GraphDtoNode): GraphNode[] {
    const nodes = new Map<string, GraphNode>();
    console.log(graph);

    for (const post of graph.nodes) {
        nodes.set(post.id, {
            post,
            observations: [],
            children: [],
            depth: 0,
        });
    }

    const hasParent = new Set<string>();

    for (const edge of graph.edges) {
        const parent = nodes.get(edge.source);
        const child = nodes.get(edge.target);

        if (!parent || !child) {
            continue;
        }

        parent.children.push(child);
        hasParent.add(edge.target);
    }

    const roots = [...nodes.values()].filter(node => !hasParent.has(node.post.id));

    for (const root of roots) {
        assignDepth(root, 0);
    }

    return roots;
}



function assignDepth(
    node: GraphNode,
    depth: number
) {
    node.depth = depth;

    for (const child of node.children) {
        assignDepth(child, depth + 1);
    }
}


export function attachObservations(
    nodes: GraphNode[],
    observations: Observation[]
): GraphNode[] {
    const byPostId = new Map<string, Observation[]>();

    for (const observation of observations) {
        if (observation.subject.type !== "post") {
            continue;
        }

        const postId = observation.subject.id;
        const list = byPostId.get(postId) ?? [];

        list.push(observation);
        byPostId.set(postId, list);
    }

    return nodes.map(node => attachNode(node, byPostId));
}

function attachNode(
    node: GraphNode,
    observations: Map<string, Observation[]>
): GraphNode {
    return {
        ...node,
        observations: observations.get(node.post.id) ?? [],
        children: node.children.map(child => attachNode(child, observations)),
    };
}