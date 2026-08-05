"use client";

import type {
  ObservationGraph,
  ObservationTreeNode,
  ObservationFilterState,
  ObservationSubjectType,
} from "../../types";

import { SubjectCard } from "./SubjectCard";

type Props = {
  node: ObservationTreeNode;
  graph: ObservationGraph;
  expanded: Set<string>;
  onToggle(key: string): void;
  filters: ObservationFilterState;
};

export function GraphNode({
  node,
  graph,
  expanded,
  onToggle,
  filters,
}: Props) {
  const expandedNode = expanded.has(node.subject.key);

  const renderSelf = includeSubject(
    node.subject.type,
    filters
  );

  if (!renderSelf) {
    return (
      <>
        {node.children.map(child => (
          <GraphNode
            key={child.subject.key}
            node={child}
            graph={graph}
            expanded={expanded}
            onToggle={onToggle}
            filters={filters}
          />
        ))}
      </>
    );
  }

  return (
    <>
      <SubjectCard
        subject={node.subject}
        graph={graph}
        filters={filters}
        expandable={node.children.length > 0}
        expanded={expandedNode}
        onToggle={() => onToggle(node.subject.key)}
      />

      {expandedNode && node.children.length > 0 && (
        <div className="thread-indent">
          {node.children.map(child => (
            <GraphNode
              key={child.subject.key}
              node={child}
              graph={graph}
              expanded={expanded}
              onToggle={onToggle}
              filters={filters}
            />
          ))}
        </div>
      )}
    </>
  );
}

function includeSubject(
  type: ObservationSubjectType,
  filters: ObservationFilterState
): boolean {
  switch (type) {
    case "thread":
      return filters.includeThread;
    case "post":
      return filters.includePosts;
    case "edge":
      return filters.includeEdges;
    case "participant":
      return filters.includeParticipants;
    case "branch":
      return filters.includeBranches;
  }
}