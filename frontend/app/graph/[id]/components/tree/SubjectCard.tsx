"use client";

import { useEffect, useMemo, useState } from "react";

import type {
  GraphPost,
  GraphSubject,
  ObservationGraph,
  ObservationFilterState,
  Observation,
} from "../../types";

import { ObservationList } from "./ObservationList";

type Props = {
  subject: GraphSubject;
  graph: ObservationGraph;
  filters: ObservationFilterState;
  expandable: boolean;
  expanded: boolean;
  onToggle(): void;
};

export function SubjectCard({
  subject,
  graph,
  filters,
  expandable,
  expanded,
  onToggle,
}: Props) {
  const [hovered, setHovered] = useState(false);

  const [showAuthor, setShowAuthor] = useState<boolean | null>(null);
  const [showContent, setShowContent] = useState<boolean | null>(null);

  useEffect(() => {
    if (!hovered) return;

    function onKeyDown(e: KeyboardEvent) {
      switch (e.key.toLowerCase()) {
        case "a":
          e.preventDefault();
          setShowAuthor(current => current == null ? !filters.showAuthor : !current);
          break;

        case "c":
          e.preventDefault();
          setShowContent(current => current == null ? !filters.showContent : !current);
          break;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hovered, filters.showAuthor, filters.showContent]);

  const localFilters = useMemo(
    () => ({
      ...filters,
      showAuthor: showAuthor ?? filters.showAuthor,
      showContent: showContent ?? filters.showContent,
    }),
    [filters, showAuthor, showContent]
  );

  return (
    <article
      className="post"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="post-meta">
        <div className="toggle-expand-button">
          {expandable && (
            <button
              type="button"
              className="post-collapse"
              onClick={onToggle}
            >
              {expanded ? "-" : "+"}
            </button>
          )}
        </div>
      </div>

      {renderBody(subject, graph, localFilters)}
    </article>
  );
}

function renderBody(
  subject: GraphSubject,
  graph: ObservationGraph,
  filters: ObservationFilterState
) {
  switch (subject.type) {
    case "post":
      return (
        <PostCard
          post={subject.payload as GraphPost}
          observations={subject.observations}
          filters={filters}
        />
      );

    case "edge":
      return (
        <EdgeCard
          edge={subject.payload as {
            parentId: string;
            childId: string;
          }}
          graph={graph}
          observations={subject.observations}
          filters={filters}
        />
      );

    case "participant":
      return (
        <>
          <div className="post-content">
            Participant
          </div>

          <ObservationList
            observations={subject.observations}
            filters={filters}
          />
        </>
      );

    case "thread":
      return (
        <>
          <div className="post-content">
            Thread
          </div>

          <ObservationList
            observations={subject.observations}
            filters={filters}
          />
        </>
      );

    case "branch":
      return (
        <>
          <div className="post-content">
            Branch
          </div>

          <ObservationList
            observations={subject.observations}
            filters={filters}
          />
        </>
      );
  }
}

const cleanAuthorId = (id: string) => {
  if (id.startsWith("http")) return id.split("/").at(-1);
  if (id.startsWith("reddit")) return id.split(":").at(-1);
  return id;
};

function PostCard({
  post,
  observations,
  filters,
}: {
  post: GraphPost;
  observations: Observation[];
  filters: ObservationFilterState;
}) {
  return (
    <div className="post-content">
      {filters.showAuthor && (
        <div className="post-author">
          {cleanAuthorId(post.authorId)}
        </div>
      )}

      {filters.showContent && (
        <div className="post-body">
          {post.body}
        </div>
      )}

      <ObservationList
        observations={observations}
        filters={filters}
      />
    </div>
  );
}

function EdgeCard({
  edge,
  graph,
  observations,
  filters,
}: {
  edge: {
    parentId: string;
    childId: string;
  };
  graph: ObservationGraph;
  observations: Observation[];
  filters: ObservationFilterState;
}) {
  const parent = graph.posts.get(edge.parentId);
  const child = graph.posts.get(edge.childId);

  let parentAuthor = "";
  let childAuthor = "";

  if (filters.showAuthor && parent?.authorId) {
    parentAuthor = cleanAuthorId(parent.authorId) + ": ";
  }

  if (filters.showAuthor && child?.authorId) {
    childAuthor = cleanAuthorId(child.authorId) + ": ";
  }

  return (
    <div className="post-content">
      {filters.showContent && (
        <>
          <div>{parentAuthor}{parent?.body}</div>
          <hr />
          <div>{childAuthor}{child?.body}</div>
        </>
      )}

      <ObservationList
        observations={observations}
        filters={filters}
      />
    </div>
  );
}