"use client";

import type { ObservationFilterState } from "../types";

interface Props {
  types: string[];
  filters: ObservationFilterState;
  onChange(filters: ObservationFilterState): void;
}

const SUBJECTS = [
  { key: "includeThread", label: "Thread" },
  { key: "includePosts", label: "Posts" },
  { key: "includeEdges", label: "Edges" },
  { key: "includeParticipants", label: "Participants" },
  { key: "includeBranches", label: "Branches" },
  { key: "includePaths", label: "Paths" },
  { key: "includeSessions", label: "Sessions" },
] as const;

export function ObservationFilters({
  types,
  filters,
  onChange,
}: Props) {
  function update(patch: Partial<ObservationFilterState>) {
    onChange({
      ...filters,
      ...patch,
    });
  }

  function toggleType(type: string) {
    const enabledTypes = new Set(filters.enabledTypes);

    if (enabledTypes.has(type)) {
      enabledTypes.delete(type);
    } else {
      enabledTypes.add(type);
    }

    update({
      enabledTypes,
    });
  }

  const namespaces = new Map<string, string[]>();

  for (const type of types) {
    const namespace = type.split(".").slice(0, 2).join(".");
    const list = namespaces.get(namespace) ?? [];
    list.push(type);
    namespaces.set(namespace, list);
  }

  return (
    <>
      <div className="graph-section">
        <div className="graph-section-title">
          Subjects
        </div>

        <div className="graph-list-horizontal">
          {SUBJECTS.map(({ key, label }) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={filters[key]}
                onChange={e =>
                  update({
                    [key]: e.target.checked,
                  })
                }
              />
              <span className="pl-1">
                {label}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="graph-divider" />

      <div className="graph-section">
        <div className="graph-section-title">
          Display
        </div>

        <div className="graph-list-horizontal">
          <label>
            <input
              type="checkbox"
              checked={filters.showAuthor}
              onChange={e =>
                update({
                  showAuthor: e.target.checked,
                })
              }
            />
            <span className="pl-1">
              Show author
            </span>
          </label>

          <label>
            <input
              type="checkbox"
              checked={filters.showContent}
              onChange={e =>
                update({
                  showContent: e.target.checked,
                })
              }
            />
            <span className="pl-1">
              Show content
            </span>
          </label>

          <label>
            <input
              type="checkbox"
              checked={filters.showEmpty}
              onChange={e =>
                update({
                  showEmpty: e.target.checked,
                })
              }
            />
            <span className="pl-1">
              Show empty nodes
            </span>
          </label>
        </div>
      </div>

      <div className="graph-divider" />

      <div className="graph-section">
        <div className="graph-section-title">
          Observation Namespaces
        </div>

        {[...namespaces.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([namespace, namespaceTypes]) => (
            <div key={namespace} className="mb-3">
              <div className="graph-section-title">
                {namespace}
              </div>

              <div className="graph-list">
                {namespaceTypes.map(type => (
                  <label key={type}>
                    <input
                      type="checkbox"
                      checked={filters.enabledTypes.has(type)}
                      onChange={() => toggleType(type)}
                    />
                    {type.split(".").at(-1)}
                  </label>
                ))}
              </div>
            </div>
          ))}
      </div>
    </>
  );
}