"use client";

import { stringify } from "querystring";
import type { ObservationFilterState } from "../types";

interface Props {
    types: string[];
    filters: ObservationFilterState;
    onChange(filters: ObservationFilterState): void;
}

const SUBJECTS = [
    "post",
    "edge",
    "participant",
    "thread",
] as const;

export function ObservationFilters({
    types,
    filters,
    onChange,
}: Props) {
    function update(
        patch: Partial<ObservationFilterState>
    ) {
        onChange({
            ...filters,
            ...patch,
        });
    }

    function toggleType(type: string) {
        update({
            types: filters.types.includes(type)
                ? filters.types.filter(t => t !== type)
                : [...filters.types, type],
        });
    }

    return (
        <>
            <div className="graph-section">
                <div className="graph-section-title">
                    Subject
                </div>

                <div className="graph-list-horizontal">
                    {SUBJECTS.map(subject => (
                        <label key={subject}>
                            <input
                                type="radio"
                                name="observation-subject"
                                checked={filters.subject === subject}
                                onChange={() =>
                                    update({ subject })
                                }
                            />
                            <span className="pl-1">
                                {subject.charAt(0).toUpperCase() + subject.slice(1)}
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
                    Observation Types
                </div>

                <div className="graph-list">
                    {types.map(type => (
                        <label key={type}>
                            <input
                                type="checkbox"
                                checked={filters.types.includes(type)}
                                onChange={() => toggleType(type)}
                            />
                            {type}
                        </label>
                    ))}
                </div>
            </div>
        </>
    );
}