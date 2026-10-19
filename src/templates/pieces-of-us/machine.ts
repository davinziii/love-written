/**
 * Pieces of Us — the story's scenes as one explicit state machine. Actions that don't fit the
 * current scene are ignored, so a double tap can't skip a memory or open the letter early.
 */

export type Scene =
  | "INVITE"
  /** Putting photo `current` back together. */
  | "PUZZLE"
  /** The finished photo as a Polaroid (flip for the hidden message). */
  | "MEMORY"
  /** The heart with one golden piece missing. */
  | "MISSING"
  | "LETTER";

export type Overlay = null | "GALLERY" | "CONFIRM_REPLAY" | "CONFIRM_RESTART";

export type StoryState = {
  scene: Scene;
  overlay: Overlay;
  /** Index of the puzzle being played / just finished. */
  current: number;
  /** How many puzzles are finished. */
  done: number;
  total: number;
  /** Bumped by "restart this puzzle" — remounts the puzzle with freshly mixed pieces. */
  attempt: number;
  /** Bumped by "replay" — a completely fresh start. */
  run: number;
  letterSeen: boolean;
};

export type Action =
  | { type: "open" }
  | { type: "solved" }
  | { type: "next" }
  | { type: "goldenPlaced" }
  | { type: "showLetter" }
  | { type: "overlay"; overlay: Exclude<Overlay, null> }
  | { type: "closeOverlay" }
  | { type: "restartPuzzle" }
  | { type: "replay" }
  /** The number of puzzles changed (in the editor): start over with the new count. */
  | { type: "setTotal"; total: number };

export function initialStory(total: number, run = 0): StoryState {
  return { scene: "INVITE", overlay: null, current: 0, done: 0, total: Math.max(1, total), attempt: 0, run, letterSeen: false };
}

export function reduce(s: StoryState, a: Action): StoryState {
  switch (a.type) {
    case "open":
      return s.scene === "INVITE" ? { ...s, scene: "PUZZLE" } : s;

    case "solved":
      if (s.scene !== "PUZZLE" || s.done > s.current) return s;
      return { ...s, scene: "MEMORY", done: s.current + 1 };

    // From a Polaroid: the next puzzle, or the finale after the last one.
    case "next":
      if (s.scene !== "MEMORY") return s;
      if (s.current + 1 < s.total) return { ...s, scene: "PUZZLE", current: s.current + 1, attempt: 0 };
      return { ...s, scene: s.letterSeen ? "LETTER" : "MISSING" };

    case "goldenPlaced":
      return s.scene === "MISSING" ? { ...s, scene: "LETTER", letterSeen: true } : s;

    case "showLetter":
      return s.letterSeen ? { ...s, scene: "LETTER", overlay: null } : s;

    case "overlay":
      if (a.overlay === "GALLERY" && s.done === 0) return s;
      if (a.overlay === "CONFIRM_RESTART" && s.scene !== "PUZZLE") return s;
      if (a.overlay === "CONFIRM_REPLAY" && s.scene === "INVITE") return s;
      return { ...s, overlay: a.overlay };

    case "closeOverlay":
      return { ...s, overlay: null };

    case "restartPuzzle":
      return s.overlay === "CONFIRM_RESTART" ? { ...s, overlay: null, attempt: s.attempt + 1 } : s;

    case "replay":
      return s.overlay === "CONFIRM_REPLAY" ? initialStory(s.total, s.run + 1) : s;

    case "setTotal":
      return a.total === s.total ? s : initialStory(a.total, s.run + 1);
  }
}
