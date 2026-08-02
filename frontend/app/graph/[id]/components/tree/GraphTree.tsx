"use client";

import { useState } from "react";

import type {
    GraphNode as GraphNodeType,
    ObservationFilterState,
} from "../../types";

import { GraphNode } from "./GraphNode";

type GraphTreeProps = {
    nodes: GraphNodeType[];
    filters: ObservationFilterState;
};

export function GraphTree({
    nodes,
    filters,
}: GraphTreeProps) {
    const [expanded, setExpanded] = useState(
        () => new Set(allPostIds(nodes))
    );

    function toggle(postId: string) {
        setExpanded(current => {
            const next = new Set(current);

            if (next.has(postId)) {
                next.delete(postId);
            } else {
                next.add(postId);
            }

            return next;
        });
    }

    function expandAll() {
        setExpanded(new Set(allPostIds(nodes)));
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
                    type="button"
                    onClick={collapseAll}
                >
                    Collapse All
                </button>
            </div>

            {nodes.map(node => (
                <GraphNode
                    key={node.post.id}
                    node={node}
                    expanded={expanded}
                    onToggle={toggle}
                    filters={filters}
                />
            ))}
        </div>
    );
}

function allPostIds(
    nodes: GraphNodeType[]
): string[] {
    return nodes.flatMap(node => [
        node.post.id,
        ...allPostIds(node.children),
    ]);
}