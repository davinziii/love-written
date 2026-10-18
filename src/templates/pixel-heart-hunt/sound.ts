/**
 * Tiny 8-bit sound effects made on the fly with Web Audio — no audio files.
 * Nothing plays until the player turns sound on (that tap also unlocks audio on iOS).
 */
type Note = { f: number; at: number; len: number; type?: OscillatorType; vol?: number; slide?: number };

export function createSound() {
  let ctx: AudioContext | null = null;

  const ensure = () => {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  };

  const play = (notes: Note[]) => {
    const ac = ensure();
    if (!ac) return;
    const t0 = ac.currentTime + 0.01;
    for (const n of notes) {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = n.type ?? "square";
      osc.frequency.setValueAtTime(n.f, t0 + n.at);
      if (n.slide) osc.frequency.exponentialRampToValueAtTime(n.slide, t0 + n.at + n.len);
      gain.gain.setValueAtTime(n.vol ?? 0.05, t0 + n.at);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + n.at + n.len);
      osc.connect(gain).connect(ac.destination);
      osc.start(t0 + n.at);
      osc.stop(t0 + n.at + n.len + 0.02);
    }
  };

  return {
    wake: () => void ensure(),
    shot: () => play([{ f: 660, slide: 330, at: 0, len: 0.08, type: "triangle", vol: 0.06 }]),
    pop: () =>
      play([
        { f: 880, slide: 1320, at: 0, len: 0.06 },
        { f: 1320, slide: 660, at: 0.05, len: 0.1, vol: 0.04 },
      ]),
    unlock: () =>
      play([
        { f: 784, at: 0, len: 0.1 },
        { f: 988, at: 0.1, len: 0.1 },
        { f: 1175, at: 0.2, len: 0.1 },
        { f: 1568, at: 0.3, len: 0.22, vol: 0.04 },
      ]),
    close: () => {
      void ctx?.close();
      ctx = null;
    },
  };
}
