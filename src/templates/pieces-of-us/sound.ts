/**
 * Soft paper-and-wood sounds made with Web Audio — no files. Silent until the player turns
 * sound on (that tap also unlocks audio on iOS).
 */
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
  const tone = (f: number, at: number, len: number, vol: number, type: OscillatorType = "sine") => {
    const ac = ensure();
    if (!ac) return;
    const t0 = ac.currentTime + 0.01 + at;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f, t0);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
    osc.connect(gain).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + len + 0.02);
  };
  return {
    wake: () => void ensure(),
    click: () => {
      tone(1400, 0, 0.035, 0.05, "triangle");
      tone(420, 0.005, 0.06, 0.05);
    },
    chime: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, i * 0.09, 0.5, 0.035)),
    close: () => {
      void ctx?.close();
      ctx = null;
    },
  };
}

export type Sound = ReturnType<typeof createSound>;
