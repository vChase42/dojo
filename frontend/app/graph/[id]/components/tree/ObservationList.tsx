"use client";

import type {
  Observation,
  ObservationFilterState,
} from "../../types";

type ObservationListProps = {
  observations: Observation[];
  filters: ObservationFilterState;
};

export function ObservationList({
  observations,
  filters,
}: ObservationListProps) {
  const visible = observations.filter(
    observation =>
      filters.types.length === 0 ||
      filters.types.includes(observation.type)
  );

  if (!filters.showEmpty && visible.length === 0) {
    return null;
  }

  return (
    <div className="observation-list">
      {visible.map((observation, index) => (
        <div
          key={index}
          className="observation-row"
        >
          <div className="observation-type">
            {observation.type}
          </div>

          <div className="observation-value">
            {renderObservation(observation.data)}
          </div>
        </div>
      ))}
    </div>
  );
}

function renderObservation(payload: unknown): string {
  if (payload == null) {
    return "";
  }

  if (
    typeof payload === "string" ||
    typeof payload === "number" ||
    typeof payload === "boolean"
  ) {
    return String(payload);
  }

  return JSON.stringify(payload);
}