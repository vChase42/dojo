"use client";

import { useEffect, useMemo, useState } from "react";

import type {
  GraphPost,
  GraphSubject,
  ObservationGraph,
  ObservationFilterState,
  Observation,
  ObservationSubjectType,
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

function observationsBySubject(
  observations: Observation[],
  subject: ObservationSubjectType
): Observation[] {
  return observations.filter(observation => observation.subject.type === subject);
}



function ObservationPanel({
  title,
  subject,
  observations,
  filters,
}: {
  title: string;
  subject: ObservationSubjectType;
  observations: Observation[];
  filters: ObservationFilterState;
}) {
  if (observations.length === 0) {
    return null;
  }

  return (
    <div className={`observation-panel s-${subject}`}>
      <div className="observation-panel-title">
        {title}
      </div>

      <ObservationList
        observations={observations}
        filters={filters}
      />
    </div>
  );
}

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
  const [expandedContent, setExpandedContent] = useState(false);



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
        case "e":
          e.preventDefault();
          setExpandedContent(current => !current);
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
        {subject.type}
      </div>

      {renderBody(subject, graph, localFilters,expandedContent,() => setExpandedContent(current => !current))}
    </article>
  );
}
function renderBody(
  subject: GraphSubject,
  graph: ObservationGraph,
  filters: ObservationFilterState,
  expandedContent: boolean,
  onToggleContent: () => void
) {
  switch (subject.type) {
    case "post":
      return (
        <PostCard
          post={subject.renderPayload as GraphPost}
          observations={subject.observations}
          filters={filters}
          expandedContent={expandedContent}
          onToggleContent={onToggleContent}
        />
      );

    case "edge":
      return (
        <EdgeCard
          edge={subject.renderPayload as {
            parentId: string;
            childId: string;
          }}
          graph={graph}
          observations={subject.observations}
          filters={filters}
          expandedContent={expandedContent}
          onToggleContent={onToggleContent}
        />
      );

    case "participant":
      return (
        <div className="post-content">
          <ObservationPanel
            title="Participant"
            subject="participant"
            observations={subject.observations}
            filters={filters}
          />
        </div>
      );

    case "thread":
      return (
        <div className="post-content">
          <ObservationPanel
            title="Thread"
            subject="thread"
            observations={observationsBySubject(subject.observations, "thread")}
            filters={filters}
          />
        </div>
      );
  }
}

const cleanAuthorId = (id: string) => {
  if (id.startsWith("http")) return id.split("/").at(-1);
  if (id.startsWith("reddit")) return id.split(":").at(-1);
  return id;
};

const CONTENT_PREVIEW_LENGTH = 50;

function renderContent(content: string, expanded: boolean): string {
  if (expanded) return content;

  const paragraph = content.indexOf("\n\n");
  return content.slice(0, Math.min(content.length, CONTENT_PREVIEW_LENGTH, paragraph === -1 ? content.length : paragraph));
}

function shouldShowExpandButton(
  content: string,
  expanded: boolean
): boolean {
  return content.length > CONTENT_PREVIEW_LENGTH;
}

function PostCard({
  post,
  observations,
  filters,
  expandedContent,
  onToggleContent,
}: {
  post: GraphPost;
  observations: Observation[];
  filters: ObservationFilterState;
  expandedContent: boolean;
  onToggleContent(): void;
}) {
  return (
    <div className="post-content">
      {filters.showContent && (
        <div className="post-body">
          {filters.showAuthor && post.authorIri && (
            <>
              <span className="post-author">
                {cleanAuthorId(post.authorIri)}
              </span>
              {": "}
            </>
          )}

          {renderContent(post.content, expandedContent)}

          {shouldShowExpandButton(post.content, expandedContent) && (
            <button
              type="button"
              className="expandable-button"
              onClick={onToggleContent}
            >
              [...]
            </button>
          )}
        </div>
      )}

      {filters.includePosts && (
      <ObservationPanel
        title="Post"
        subject="post"
        observations={observationsBySubject(observations, "post")}
        filters={filters}
      />)}

      {filters.includeBranches && (
        <ObservationPanel
          title="Branch"
          subject="branch"
          observations={observationsBySubject(observations, "branch")}
          filters={filters}
        />
      )}

      {filters.includePaths && (<ObservationPanel
        title="Path"
        subject="path"
        observations={observationsBySubject(observations, "path")}
        filters={filters}
      />)}
    </div>
  );
}

function EdgeCard({
  edge,
  graph,
  observations,
  filters,
  expandedContent,
  onToggleContent,
}: {
  edge: {
    parentId: string;
    childId: string;
  };
  graph: ObservationGraph;
  observations: Observation[];
  filters: ObservationFilterState;
  expandedContent: boolean;
  onToggleContent(): void;
}) {
  const parent = graph.posts.get(edge.parentId);
  const child = graph.posts.get(edge.childId);

  let parentAuthor = "";
  let childAuthor = "";

  if (filters.showAuthor && parent?.authorIri) {
    parentAuthor = cleanAuthorId(parent.authorIri) + ": ";
  }

  if (filters.showAuthor && child?.authorIri) {
    childAuthor = cleanAuthorId(child.authorIri) + ": ";
  }

  return (
    <div className="post-content">
      {filters.showContent && (
        <>
<div>
  {parentAuthor}
  {parent && renderContent(parent.content, expandedContent)}

  {parent &&
    shouldShowExpandButton(parent.content, expandedContent) && (
      <button
        type="button"
        className="expandable-button"
        onClick={onToggleContent}
      >
        [...]
      </button>
    )}
</div>
          <hr />
<div>
  {childAuthor}
  {child && renderContent(child.content, expandedContent)}

  {child &&
    shouldShowExpandButton(child.content, expandedContent) && (
      <button
        type="button"
        className="expandable-button"
        onClick={onToggleContent}
      >
        [...]
      </button>
    )}
</div>        </>
      )}

      <ObservationPanel
        title="Edge"
        subject="edge"
        observations={observations}
        filters={filters}
      />
    </div>
  );
}