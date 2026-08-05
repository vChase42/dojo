"use client";

import { useEffect, useRef, useState } from "react";

import type {
  ObservationGraph,
  ObservationTreeNode,
  ObservationFilterState,
} from "../../types";

import { GraphNode } from "./ObservationTreeNode";

type GraphTreeProps = {
  graph: ObservationGraph;
  filters: ObservationFilterState;
};

export function GraphTree({
  graph,
  filters,
}: GraphTreeProps) {
  const [expanded, setExpanded] = useState(() => new Set<string>());
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) return;

    setExpanded(new Set(allKeys(graph.root)));
    hasInitialized.current = true;
  }, [graph]);

  function toggle(key: string) {
    setExpanded(current => {
      const next = new Set(current);

      next.has(key) ? next.delete(key) : next.add(key);

      return next;
    });
  }

  function expandAll() {
    setExpanded(new Set(allKeys(graph.root)));
  }

  function collapseAll() {
    setExpanded(new Set());
  }

  return (
    <div className="graph-tree">
      <div className="graph-tree-actions">
        <button
          type="button"
          onClick={expandAll}
        >
          Expand All
        </button>

        <button
          className="m-1"
          type="button"
          onClick={collapseAll}
        >
          Collapse All
        </button>
      </div>

      <GraphNode
        node={graph.root}
        graph={graph}
        expanded={expanded}
        onToggle={toggle}
        filters={filters}
      />
    </div>
  );
}

function allKeys(
  node: ObservationTreeNode
): string[] {
  return [
    node.subject.key,
    ...node.children.flatMap(allKeys),
  ];
}