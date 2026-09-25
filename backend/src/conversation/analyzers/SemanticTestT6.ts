import { Analyzer, AnalyzerContext, Observation } from "../core/types";

import {
  EmbeddingModel,
  EmbeddingRepository,
} from "../persistence/embeddings/types";

import { EmbeddingCollection } from "../persistence/embeddings/EmbeddingCollection";
import { collectEmbeddableSubjects } from "../persistence/embeddings/utils";
import { cosine } from "../persistence/embeddings/vector";

interface Candidate {
  relationship: string;
  text: string;
}

interface RankingTest {
  name: string;
  anchor: string;
  candidates: Candidate[];
}

const tests: RankingTest[] = [
  {
    name: "topic-vs-discourse-function",
    anchor: "Can someone explain how evolution works?",
    candidates: [
      {
        relationship: "same-topic-explanation",
        text: "Natural selection causes populations to change over generations.",
      },
      {
        relationship: "same-topic-question",
        text: "How does natural selection cause evolution?",
      },
      {
        relationship: "same-discourse-function",
        text: "Can someone explain how PostgreSQL transactions work?",
      },
      {
        relationship: "same-topic-confusion",
        text: "I don't understand evolution.",
      },
      {
        relationship: "same-topic-opposition",
        text: "Evolution is completely wrong.",
      },
      {
        relationship: "unrelated",
        text: "The refrigerator is full of vegetables.",
      },
    ],
  },

  {
    name: "paraphrase-vs-lexical-overlap",
    anchor: "The meeting starts at noon.",
    candidates: [
      {
        relationship: "paraphrase",
        text: "The meeting begins at 12 PM.",
      },
      {
        relationship: "lexical-overlap-different-time",
        text: "The meeting starts at midnight.",
      },
      {
        relationship: "lexical-overlap-negated",
        text: "The meeting does not start at noon.",
      },
      {
        relationship: "related-topic",
        text: "The meeting has been scheduled.",
      },
      {
        relationship: "same-time-unrelated-event",
        text: "Lunch starts at noon.",
      },
      {
        relationship: "unrelated",
        text: "Whales communicate using sound.",
      },
    ],
  },

  {
    name: "argument-role-reversal",
    anchor: "The dog bit the man.",
    candidates: [
      {
        relationship: "paraphrase",
        text: "The man was bitten by the dog.",
      },
      {
        relationship: "role-reversal",
        text: "The man bit the dog.",
      },
      {
        relationship: "same-subject-different-action",
        text: "The dog chased the man.",
      },
      {
        relationship: "same-action-different-object",
        text: "The dog bit the cat.",
      },
      {
        relationship: "topic-related",
        text: "The dog attacked someone.",
      },
      {
        relationship: "unrelated",
        text: "The database rejected the transaction.",
      },
    ],
  },

  {
    name: "polarity-vs-topic",
    anchor: "I strongly support building more nuclear power plants.",
    candidates: [
      {
        relationship: "same-position-paraphrase",
        text: "I think we should construct more nuclear power stations.",
      },
      {
        relationship: "opposite-position",
        text: "I strongly oppose building more nuclear power plants.",
      },
      {
        relationship: "same-topic-neutral",
        text: "Nuclear power plants generate electricity.",
      },
      {
        relationship: "same-attitude-different-topic",
        text: "I strongly support building more public transportation.",
      },
      {
        relationship: "related-energy-topic",
        text: "Solar panels generate electricity from sunlight.",
      },
      {
        relationship: "unrelated",
        text: "My neighbor bought a new bicycle.",
      },
    ],
  },

  {
    name: "question-type",
    anchor: "Why did the server crash?",
    candidates: [
      {
        relationship: "paraphrase",
        text: "What caused the server to crash?",
      },
      {
        relationship: "same-topic-different-question",
        text: "When did the server crash?",
      },
      {
        relationship: "same-topic-answer",
        text: "The server crashed because it ran out of memory.",
      },
      {
        relationship: "same-question-type-different-topic",
        text: "Why did the Roman Empire collapse?",
      },
      {
        relationship: "lexical-overlap",
        text: "The server crash affected thousands of users.",
      },
      {
        relationship: "unrelated",
        text: "The garden needs more water.",
      },
    ],
  },

  {
    name: "entailment-ish",
    anchor: "A golden retriever is running through the park.",
    candidates: [
      {
        relationship: "generalization",
        text: "A dog is running outside.",
      },
      {
        relationship: "paraphrase",
        text: "A golden retriever runs through a park.",
      },
      {
        relationship: "same-entity-different-action",
        text: "A golden retriever is sleeping in the park.",
      },
      {
        relationship: "same-action-different-entity",
        text: "A child is running through the park.",
      },
      {
        relationship: "contradiction-ish",
        text: "The golden retriever is not running.",
      },
      {
        relationship: "unrelated",
        text: "Saturn has many moons.",
      },
    ],
  },

  {
    name: "numeric-sensitivity",
    anchor: "The building has 10 floors.",
    candidates: [
      {
        relationship: "paraphrase",
        text: "There are ten stories in the building.",
      },
      {
        relationship: "different-number",
        text: "The building has 100 floors.",
      },
      {
        relationship: "different-number-close",
        text: "The building has 11 floors.",
      },
      {
        relationship: "negated",
        text: "The building does not have 10 floors.",
      },
      {
        relationship: "same-number-different-property",
        text: "The building has 10 elevators.",
      },
      {
        relationship: "unrelated",
        text: "There are 10 apples on the table.",
      },
    ],
  },

  {
    name: "temporal-sensitivity",
    anchor: "Alice works at the hospital.",
    candidates: [
      {
        relationship: "paraphrase",
        text: "Alice is employed by the hospital.",
      },
      {
        relationship: "past",
        text: "Alice used to work at the hospital.",
      },
      {
        relationship: "future",
        text: "Alice will work at the hospital.",
      },
      {
        relationship: "negated",
        text: "Alice does not work at the hospital.",
      },
      {
        relationship: "different-person",
        text: "Bob works at the hospital.",
      },
      {
        relationship: "same-person-different-place",
        text: "Alice works at the university.",
      },
    ],
  },

  {
    name: "entity-vs-relation",
    anchor: "Alice gave Bob the book.",
    candidates: [
      {
        relationship: "paraphrase",
        text: "Bob received the book from Alice.",
      },
      {
        relationship: "reversed-relation",
        text: "Bob gave Alice the book.",
      },
      {
        relationship: "different-object",
        text: "Alice gave Bob the keys.",
      },
      {
        relationship: "different-recipient",
        text: "Alice gave Charlie the book.",
      },
      {
        relationship: "same-entities-different-relation",
        text: "Alice borrowed the book from Bob.",
      },
      {
        relationship: "unrelated",
        text: "Charlie drove his car to work.",
      },
    ],
  },

  {
    name: "sentiment-vs-topic",
    anchor: "The new movie was absolutely wonderful.",
    candidates: [
      {
        relationship: "same-sentiment-same-topic",
        text: "The new movie was fantastic.",
      },
      {
        relationship: "opposite-sentiment-same-topic",
        text: "The new movie was absolutely terrible.",
      },
      {
        relationship: "neutral-same-topic",
        text: "I watched the new movie yesterday.",
      },
      {
        relationship: "same-sentiment-different-topic",
        text: "The new restaurant was absolutely wonderful.",
      },
      {
        relationship: "opposite-sentiment-different-topic",
        text: "The new restaurant was absolutely terrible.",
      },
      {
        relationship: "unrelated",
        text: "PostgreSQL supports multiple isolation levels.",
      },
    ],
  },

  {
    name: "discourse-agreement",
    anchor: "I think your explanation is correct.",
    candidates: [
      {
        relationship: "agreement-paraphrase",
        text: "I agree with your explanation.",
      },
      {
        relationship: "disagreement",
        text: "I think your explanation is wrong.",
      },
      {
        relationship: "generic-agreement",
        text: "You're absolutely right.",
      },
      {
        relationship: "generic-disagreement",
        text: "I completely disagree with you.",
      },
      {
        relationship: "same-topic-neutral",
        text: "Your explanation was very detailed.",
      },
      {
        relationship: "unrelated",
        text: "The train arrives tomorrow morning.",
      },
    ],
  },

  {
    name: "specificity",
    anchor: "A bird is sitting in a tree.",
    candidates: [
      {
        relationship: "more-specific",
        text: "A robin is sitting in an oak tree.",
      },
      {
        relationship: "paraphrase",
        text: "A bird is perched in a tree.",
      },
      {
        relationship: "less-specific",
        text: "An animal is outside.",
      },
      {
        relationship: "same-entities-different-relation",
        text: "A bird is flying over a tree.",
      },
      {
        relationship: "lexical-overlap-nonsense-relation",
        text: "A tree is sitting on a bird.",
      },
      {
        relationship: "unrelated",
        text: "The computer finished installing an update.",
      },
    ],
  },

  {
    name: "causal-relation",
    anchor: "The road is wet because it rained.",
    candidates: [
      {
        relationship: "paraphrase",
        text: "Rain caused the road to become wet.",
      },
      {
        relationship: "causal-reversal",
        text: "The wet road caused it to rain.",
      },
      {
        relationship: "same-facts-no-causality",
        text: "It rained and the road is wet.",
      },
      {
        relationship: "same-effect-different-cause",
        text: "The road is wet because a pipe burst.",
      },
      {
        relationship: "same-cause-different-effect",
        text: "The grass is wet because it rained.",
      },
      {
        relationship: "unrelated",
        text: "The programmer fixed the bug.",
      },
    ],
  },

  {
    name: "instruction-intent",
    anchor: "Please explain how to reset my password.",
    candidates: [
      {
        relationship: "paraphrase",
        text: "Can you tell me how to reset my password?",
      },
      {
        relationship: "same-topic-statement",
        text: "I reset my password yesterday.",
      },
      {
        relationship: "same-topic-problem",
        text: "My password doesn't work.",
      },
      {
        relationship: "same-intent-different-topic",
        text: "Please explain how to restart my computer.",
      },
      {
        relationship: "answer",
        text: "Click the reset password link and follow the instructions.",
      },
      {
        relationship: "unrelated",
        text: "My dog likes sleeping on the couch.",
      },
    ],
  },

  {
    name: "lexical-ambiguity",
    anchor: "I deposited money at the bank.",
    candidates: [
      {
        relationship: "same-sense",
        text: "I put cash into my bank account.",
      },
      {
        relationship: "different-sense-same-word",
        text: "We sat on the bank of the river.",
      },
      {
        relationship: "same-topic-no-bank-word",
        text: "The financial institution accepted my deposit.",
      },
      {
        relationship: "same-word-financial",
        text: "The bank approved my loan.",
      },
      {
        relationship: "river-topic",
        text: "The river overflowed after the storm.",
      },
      {
        relationship: "unrelated",
        text: "The telescope captured an image of Jupiter.",
      },
    ],
  },
];

export class SemanticTest6 implements Analyzer {
  readonly id = "semantic-test-6";
  readonly version = "1";

  readonly observationTypes = [
    "debug.embedding.ranking",
  ];

  readonly dependsOn = [
    "structural",
  ];

  constructor(
    private readonly repository: EmbeddingRepository,
    private readonly model: EmbeddingModel,
  ) {}

  async analyze(context: AnalyzerContext): Promise<Observation[]> {
    const subjects = collectEmbeddableSubjects(
      context.snapshot,
      context.observations,
    ).filter(subject => subject.subject.type === "post");

    const collection = new EmbeddingCollection(
      context.snapshot,
      this.repository,
      this.model,
      subjects,
    );

    await collection.initialize();

    const results = [];

    for (const test of tests) {
      const anchor = await collection.vector(test.anchor);
      const candidates = [];

      for (const candidate of test.candidates) {
        const vector = await collection.vector(candidate.text);

        candidates.push({
          relationship: candidate.relationship,
          text: candidate.text,
          cosine: cosine(anchor, vector),
        });
      }

      candidates.sort((a, b) => b.cosine - a.cosine);

      results.push({
        name: test.name,
        anchor: test.anchor,
        ranking: candidates.map((candidate, index) => ({
          rank: index + 1,
          ...candidate,
        })),
      });
    }

    return [
      {
        subject: {
          type: "thread",
          id: context.snapshot.thread.id,
        },
        type: "debug.embedding.ranking",
        analyzerId: this.id,
        analyzerVersion: this.version,
        data: {
          modelId: this.model.id,
          modelVersion: this.model.version,
          dimensions: this.model.dimensions,
          tests: results,
        },
        computedAt: new Date(),
      },
    ];
  }
}