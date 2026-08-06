import { Observation, ObservationSubject } from "../core/types";

export function createObserver(params: {
  analyzerId: string;
  analyzerVersion: string;
  observations: Observation[];
  computedAt?: Date;
}) {
  const computedAt = params.computedAt ?? new Date();

  return <T extends Record<string, unknown>>(subject: ObservationSubject, type: string, data: T) => {
    params.observations.push({
      subject,
      type,
      analyzerId: params.analyzerId,
      analyzerVersion: params.analyzerVersion,
      data,
      computedAt,
    });
  };
}