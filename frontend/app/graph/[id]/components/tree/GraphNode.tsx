"use client";

import { useMemo } from "react";

import type {
    GraphNode,
    ObservationFilterState,
} from "../../types";

import { ObservationList } from "./ObservationList";

type GraphNodeProps = {
    node: GraphNode;
    expanded: Set<string>;
    onToggle(postId: string): void;
    filters: ObservationFilterState;
};

export function GraphNode({
    node,
    expanded,
    onToggle,
    filters,
}: GraphNodeProps) {
    const expandedNode = expanded.has(node.post.id);

    const childCount = useMemo(
        () => countChildren(node),
        [node]
    );

    const cleanAuthorId = (id: string) => {
        if(id.startsWith("http")){
            return id.split("\/").at(-1);
        }else if(id.startsWith("reddit")){
            return id.split(":").at(-1);
        }

        return id;
    }


return (
    <>
        <article className="post">
            <div className="post-meta">
                {filters.showAuthor && (<div className="post-author">
                    {cleanAuthorId(node.post.authorId)}
                </div>)}

                <div className="post-date">
                    {childCount} replies
                </div>
            </div>

            <div className="post-content">
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: ".5rem",
                        marginBottom: ".5rem",
                    }}
                >
                    {node.children.length > 0 && (
                        <button
                            type="button"
                            className="post-collapse"
                            onClick={() => onToggle(node.post.id)}
                        >
                            {expandedNode ? "-" : "+"}
                        </button>
                    )}

                    {filters.showContent && (<div className="post-body">
                        {node.post.body}
                    </div>)}
                </div>

                <ObservationList
                    observations={node.observations}
                    filters={filters}
                />
            </div>
        </article>

        {expandedNode && node.children.length > 0 && (
            <div className="thread-indent">
                {node.children.map(child => (
                    <GraphNode
                        key={child.post.id}
                        node={child}
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

function countChildren(
    node: GraphNode
): number {
    let count = node.children.length;

    for (const child of node.children) {
        count += countChildren(child);
    }

    return count;
}