import { Post } from "../../../types";
import { Observation, ObservationSubject, ThreadSnapshot } from "../../core/types";

export function serializePosts(
  snapshot: ThreadSnapshot,
  postIds: readonly string[]
): string {
  return postIds
    .map(id => snapshot.postsById.get(id))
    .filter((post): post is Post => post != null)
    .map(post => post.content)
    .join("\n\n");
}

export interface EmbeddableSubject {
  subject: ObservationSubject;
  postIds: string[];
}

export function collectEmbeddableSubjects(
  snapshot: ThreadSnapshot,
  observations: Map<string, Observation[]>
): EmbeddableSubject[] {
  const subjects = new Map<string, ObservationSubject>();

  for (const list of observations.values()) {
    for (const observation of list) {
      const key = `${observation.subject.type}:${observation.subject.id}`;

      if (!subjects.has(key)) {
        subjects.set(key, observation.subject);
      }
    }
  }

  return [...subjects.values()]
    .filter(isEmbeddableSubject)
    .map(subject => ({
      subject,
      postIds: collectSubjectPostIds(snapshot, observations, subject),
  }));
}

function collectSubjectPostIds(
  snapshot: ThreadSnapshot,
  observations: Map<string, Observation[]>,
  subject: ObservationSubject
): string[] {
  switch (subject.type) {
    case "thread":
      return snapshot.posts.map(post => post.id);

    case "post":
      return [subject.id];

    case "participant":
      return snapshot.posts
        .filter(post => post.authorIri === subject.id)
        .map(post => post.id);

    case "edge": {
      const [parentId, childId] = subject.id.split("::");
      return [parentId, childId];
    }

    case "session":
      return lookupPostIds(observations, subject, "temporal.session.posts");

    case "path":
      return lookupPostIds(observations, subject, "structure.path.posts");

  }
  return [];
}

function lookupPostIds(
  observations: Map<string, Observation[]>,
  subject: ObservationSubject,
  type: string
): string[] {
  const observation = observations
    .get(type)
    ?.find(o => o.subject.id === subject.id);

  if (!observation) {
    return [];
  }

  return observation.data.posts as string[];
}


function isEmbeddableSubject(subject: ObservationSubject): boolean {
  switch (subject.type) {
    case "post":
    case "edge":
    case "participant":
    case "path":
    case "session":
    case "thread":
      return true;

    case "branch":
      return false;
  }
  return false;
}