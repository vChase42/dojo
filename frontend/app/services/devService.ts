import type {
    AnalyzerDescriptor,
    RankerDescriptor,
    Observation,
} from "@/app/graph/[id]/types";

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
export function analyze(threadId: string, analyzers: string[]) {
    return apiFetch<{
        success: boolean;
        observations: Observation[];
    }>("/dev/thread/analysis", {
        method: "POST",
        body: JSON.stringify({
            threadId,
            analyzers,
        }),
    });
}

export function getGraph(threadId: string) {
    return apiFetch(
        `/dev/thread/graph?${new URLSearchParams({ threadId })}`
    );
}

export function getObservations(
    threadId: string,
    analyzers: string[] = []
) {
    const params = new URLSearchParams({
        threadId,
    });

    if (analyzers.length) {
        params.set("analyzers", analyzers.join(","));
    }

    return apiFetch<Observation[]>(
        `/dev/thread/observations?${params}`
    );
}