/**
 * Pixel Heart Hunt — the surprise's phases as one explicit state machine.
 * Every transition is listed here; an action that doesn't fit the current phase is ignored,
 * so a stray double-tap or a late event can never unlock the letter twice or skip a photo.
 */
import { STORY_HEARTS } from "./engine";

export type Phase =
  | "INTRO"
  | "PLAYING"
  | "MEMORY_REVEAL"
  | "LETTER_UNLOCK"
  | "LETTER_OPEN"
  | "ENDLESS"
  /** Looking through unlocked photos (the game waits). */
  | "GALLERY"
  /** "Start over?" */
  | "CONFIRM_RESET";

export type GameState = {
  phase: Phase;
  /** Bumped on every reset: remounts the game with fresh heart positions. */
  run: number;
  /** Hearts hit in the first round (0–5). */
  collected: number;
  /** Photos revealed so far (0–5); trails `collected` while a heart is still popping. */
  unlocked: number;
  /** Which photo is shown (reveal or gallery). */
  openMemory: number | null;
  /** Endless mode hearts. */
  score: number;
  /** Where GALLERY / CONFIRM_RESET go back to. */
  returnTo: Phase | null;
  letterSeen: boolean;
};

export type Action =
  | { type: "start" }
  | { type: "hit" }
  | { type: "popped" }
  | { type: "closeMemory" }
  | { type: "openLetter" }
  | { type: "keepPlaying" }
  | { type: "openGallery" }
  | { type: "viewMemory"; index: number }
  | { type: "back" }
  | { type: "askReset" }
  | { type: "reset" };

export function initialGame(run = 0): GameState {
  return { phase: "INTRO", run, collected: 0, unlocked: 0, openMemory: null, score: 0, returnTo: null, letterSeen: false };
}

const PAUSABLE: readonly Phase[] = ["PLAYING", "ENDLESS", "LETTER_UNLOCK"];

export function reduce(state: GameState, action: Action): GameState {
  const { phase } = state;
  switch (action.type) {
    case "start":
      return phase === "INTRO" ? { ...state, phase: "PLAYING" } : state;

    case "hit":
      if (phase === "PLAYING" && state.collected < STORY_HEARTS) return { ...state, collected: state.collected + 1 };
      if (phase === "ENDLESS") return { ...state, score: state.score + 1 };
      return state;

    // The heart finished popping: show the photo it unlocked.
    case "popped":
      if (phase !== "PLAYING" || state.unlocked >= state.collected) return state;
      return { ...state, phase: "MEMORY_REVEAL", openMemory: state.unlocked, unlocked: state.unlocked + 1 };

    case "closeMemory":
      if (phase !== "MEMORY_REVEAL") return state;
      return { ...state, phase: state.unlocked >= STORY_HEARTS ? "LETTER_UNLOCK" : "PLAYING", openMemory: null };

    case "openLetter":
      if (phase === "LETTER_UNLOCK" || (phase === "ENDLESS" && state.letterSeen)) return { ...state, phase: "LETTER_OPEN", letterSeen: true };
      return state;

    case "keepPlaying":
      return phase === "LETTER_OPEN" ? { ...state, phase: "ENDLESS" } : state;

    case "openGallery":
      if (!PAUSABLE.includes(phase) || state.unlocked === 0) return state;
      return { ...state, phase: "GALLERY", returnTo: phase, openMemory: null };

    case "viewMemory":
      if (phase !== "GALLERY" || action.index < 0 || action.index >= state.unlocked) return state;
      return { ...state, openMemory: action.index };

    case "back":
      if (phase === "GALLERY" && state.openMemory !== null) return { ...state, openMemory: null };
      if ((phase === "GALLERY" || phase === "CONFIRM_RESET") && state.returnTo) return { ...state, phase: state.returnTo, returnTo: null };
      return state;

    case "askReset":
      return PAUSABLE.includes(phase) ? { ...state, phase: "CONFIRM_RESET", returnTo: phase } : state;

    case "reset":
      return phase === "CONFIRM_RESET" ? initialGame(state.run + 1) : state;
  }
}
