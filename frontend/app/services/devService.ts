// app/services/devService.ts

import type { AnalyzerDescriptor, RankerDescriptor } from "@/app/graph/[id]/types";

const API_BASE = "/api";

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "API request failed");
  }

  return res.json();
}

export function getAnalyzers() {
  return apiFetch<AnalyzerDescriptor[]>("/dev/analyzers");
}

export function getRankers() {
  return apiFetch<RankerDescriptor[]>("/dev/rankers");
}

export function getObservationTypes() {
    return apiFetch<string[]>(
        "/dev/observation-types"
    );
}