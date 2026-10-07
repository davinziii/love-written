"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Small curated emoji picker for message boxes. No library: ~60 hand-picked emojis in
 * four groups, rendered only while open, using the device's own emoji font.
 */
const GROUPS: { name: string; emojis: [string, string][] }[] = [
  {
    name: "Love",
    emojis: [
      ["❤️", "red heart"], ["💕", "two hearts"], ["💖", "sparkling heart"], ["💗", "growing heart"],
      ["💓", "beating heart"], ["💞", "revolving hearts"], ["💘", "heart with arrow"], ["💝", "heart with ribbon"],
      ["💌", "love letter"], ["🥰", "smiling face with hearts"], ["😍", "heart eyes"], ["😘", "blowing a kiss"],
      ["💋", "kiss mark"], ["🌹", "rose"], ["💐", "bouquet"], ["💍", "ring"],
    ],
  },
  {
    name: "Smiles",
    emojis: [
      ["😊", "smiling face"], ["😄", "grinning face"], ["😂", "tears of joy"], ["🥹", "holding back tears"],
      ["😭", "crying"], ["🥺", "pleading face"], ["😌", "relieved face"], ["😉", "winking face"],
      ["🤭", "face with hand over mouth"], ["😇", "smiling with halo"], ["🤗", "hugging face"], ["😎", "cool face"],
      ["🙈", "see-no-evil monkey"], ["😳", "flushed face"], ["🫶", "heart hands"], ["🤍", "white heart"],
    ],
  },
  {
    name: "Celebrate",
    emojis: [
      ["🎉", "party popper"], ["🎂", "birthday cake"], ["🎁", "gift"], ["🥳", "partying face"],
      ["✨", "sparkles"], ["🎈", "balloon"], ["🥂", "clinking glasses"], ["🎊", "confetti ball"],
      ["🌟", "glowing star"], ["💫", "dizzy star"], ["🎶", "music notes"], ["🏆", "trophy"],
    ],
  },
  {
    name: "Cozy",
    emojis: [
      ["🌸", "cherry blossom"], ["🌷", "tulip"], ["🌻", "sunflower"], ["🌙", "crescent moon"],
      ["☀️", "sun"], ["🌊", "wave"], ["🌈", "rainbow"], ["☕", "coffee"],
      ["🍰", "cake slice"], ["🍓", "strawberry"], ["🐶", "dog"], ["🐱", "cat"],
      ["🧸", "teddy bear"], ["🦋", "butterfly"], ["🏡", "home"], ["✈️", "airplane"],
    ],
  },
];

export function EmojiPicker({ onPick, disabled }: { onPick: (emoji: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [group, setGroup] = useState(0);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-label="Add an emoji"
        // Keep the textarea's cursor position: don't steal focus on mouse down.
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
        className={`lw-press inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ring-1 transition ${
          open ? "bg-petal text-rose ring-rose" : "bg-white text-ink-soft ring-line hover:text-ink"
        }`}
      >
        <span aria-hidden className="text-sm leading-none">😊</span> Emoji
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Choose an emoji"
          className="animate-fade-up absolute right-0 z-30 mt-2 w-[min(18rem,80vw)] rounded-2xl bg-white p-2 shadow-xl ring-1 ring-black/5"
        >
          <div role="tablist" aria-label="Emoji groups" className="mb-1 flex gap-1">
            {GROUPS.map((g, i) => (
              <button
                key={g.name}
                type="button"
                role="tab"
                aria-selected={group === i}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setGroup(i)}
                className={`flex-1 rounded-full px-2 py-1 text-[11px] font-medium transition ${
                  group === i ? "bg-ink text-cream" : "text-ink-soft hover:bg-cream"
                }`}
              >
                {g.name}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-8 gap-0.5">
            {GROUPS[group]!.emojis.map(([emoji, label]) => (
              <button
                key={emoji}
                type="button"
                title={label}
                aria-label={label}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onPick(emoji)}
                className="grid aspect-square place-items-center rounded-lg text-xl transition hover:scale-110 hover:bg-petal focus-visible:bg-petal"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
