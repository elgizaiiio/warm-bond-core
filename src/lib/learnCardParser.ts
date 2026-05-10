// Parses ::learn cards (JSON blocks tagged "learn_card") out of an assistant message.
// Format expected from the AI:
//
// ```learn
// { "type": "mcq", "question": "...", "options": [...], "correct": 0, "explain": "..." }
// ```
//
// Multiple ```learn blocks per message are supported; surrounding text becomes
// regular markdown segments.

export type LearnCardType =
  | "mcq"
  | "multi"
  | "truefalse"
  | "explain"
  | "fill"
  | "match"
  | "checkin"
  | "mermaid"
  | "roadmap"
  | "exam_setup"
  | "exam_runner"
  | "photo_solve"
  | "onboarding";

export interface LearnCardData {
  type: LearnCardType;
  [k: string]: any;
}

export interface LearnSegment {
  kind: "text" | "card";
  text?: string;
  card?: LearnCardData;
}

export function parseLearnSegments(content: string): LearnSegment[] {
  if (!content) return [];
  const segments: LearnSegment[] = [];
  // Match ```learn ... ``` OR ```json with type:"learn_card"
  const re = /```(learn|learn_card)\s*\n?([\s\S]*?)```/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    if (m.index > last) {
      const t = content.slice(last, m.index);
      if (t.trim()) segments.push({ kind: "text", text: t });
    }
    try {
      const obj = JSON.parse(m[2].trim());
      if (obj && typeof obj === "object" && obj.type) {
        segments.push({ kind: "card", card: obj as LearnCardData });
      } else {
        segments.push({ kind: "text", text: m[0] });
      }
    } catch {
      segments.push({ kind: "text", text: m[0] });
    }
    last = m.index + m[0].length;
  }
  if (last < content.length) {
    const tail = content.slice(last);
    if (tail.trim()) segments.push({ kind: "text", text: tail });
  }
  if (segments.length === 0 && content.trim()) {
    segments.push({ kind: "text", text: content });
  }
  return segments;
}

export function hasLearnCards(content: string): boolean {
  return /```(learn|learn_card)\s/.test(content);
}
