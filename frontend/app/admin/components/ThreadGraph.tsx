// app/admin/components/ThreadGraph.tsx

import { JSX } from "react";

interface GraphNode {
  id: string;
  parentId: string | null;
  authorId: string;
  createdAt: string;
  body: string;
}

interface Observation {
  subject: {
    id: string;
  };

  type: string;
  data: unknown;
}

interface ThreadGraphProps {
  graph: {
    nodes: GraphNode[];
    observations: Observation[];
  } | null;
}

export function ThreadGraph({
  graph,
}: ThreadGraphProps) {
  if (!graph) {
    return null;
  }

  const children = new Map<string | null, GraphNode[]>();

  for (const node of graph.nodes) {
    const list = children.get(node.parentId) ?? [];
    list.push(node);
    children.set(node.parentId, list);
  }

  const observationsBySubject = new Map<string, Observation[]>();

  for (const observation of graph.observations) {
    const list =
      observationsBySubject.get(observation.subject.id) ?? [];

    list.push(observation);

    observationsBySubject.set(
      observation.subject.id,
      list
    );
  }

  const roots =
    children.get(null) ??
    children.get(undefined as any) ??
    [];

  const render = (
    node: GraphNode,
    depth: number
  ): JSX.Element => {
    const observations =
      observationsBySubject.get(node.id) ?? [];

    return (
      <div key={node.id}>
        <div
          className="thread-node"
          style={{
            marginLeft: depth * 32,
          }}
        >
          <div className="thread-node-header">
            <strong>{node.authorId}</strong>

            <span>{node.id}</span>
          </div>

          <div className="thread-node-body">
            {observations.length === 0 ? (
              <em>No observations</em>
            ) : (
              observations.map((obs, i) => (
                <div
                  key={i}
                  style={{ marginBottom: 12 }}
                >
                  <strong>{obs.type}</strong>

                  <pre
                    style={{
                      margin: "4px 0 0",
                    }}
                  >
                    {JSON.stringify(
                      obs.data,
                      null,
                      2
                    )}
                  </pre>
                </div>
              ))
            )}
          </div>
        </div>

        {(children.get(node.id) ?? []).map(child =>
          render(child, depth + 1)
        )}
      </div>
    );
  };

  return (
    <div className="admin-card">
      <h2>Conversation</h2>

      <div className="thread-graph">
        {roots.map(node => render(node, 0))}
      </div>
    </div>
  );
}