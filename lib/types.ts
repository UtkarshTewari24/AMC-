export const TOPICS = [
  "Algebra",
  "Geometry",
  "Number Theory",
  "Combinatorics",
  "Probability",
  "Sequences & Series",
  "Functions",
  "Trigonometry",
  "Logic & Word Problems",
] as const;

export type Topic = (typeof TOPICS)[number];

export type Difficulty = "easy" | "medium" | "hard";

export const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];

export interface Problem {
  id: string;
  year: number;
  contest: string; // AMC10 | AMC10A | AMC10B | AMC10A Fall | AMC10B Fall
  number: number; // 1-25
  topic: Topic;
  difficulty: Difficulty;
  question: string; // text with inline $...$ LaTeX
  choices: string[]; // 5 LaTeX strings (A-E), may be empty if split failed
  answer: number | null; // 0-indexed correct choice
  solution: string | null;
  has_diagram: boolean;
  diagram_url: string | null;
  aops_url: string;
}

export interface AttemptRecord {
  problemId: string;
  sessionId: string;
  chosen: number | null; // null = skipped / revealed
  correct: boolean;
  timeSpent: number; // seconds
  topic: Topic;
  difficulty: Difficulty;
  createdAt: number; // epoch ms
}

export interface SessionRecord {
  id: string;
  mode: "drill" | "random" | "test";
  label: string;
  startedAt: number;
  attempts: AttemptRecord[];
}

export interface TopicStat {
  solved: number;
  correct: number;
}

export type TopicStats = Partial<Record<Topic, TopicStat>>;
