"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Icon } from "@/components/ui/icons";

export interface DropdownOption {
  value: string;
  /** Accessible name. */
  label: string;
  /** What the option looks like in the list (and in the button when selected). */
  render: ReactNode;
}

/**
 * A small accessible listbox ("select") that can show rich options — color palettes,
 * font samples — which a native <select> can't. Keyboard: arrows, Home/End, Enter,
 * Escape; typing a letter jumps to the matching option.
 */
export function Dropdown({
  options,
  value,
  onChange,
  labelledBy,
  describedBy,
  disabled,
  columns = 1,
}: {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  labelledBy: string;
  describedBy?: string;
  disabled?: boolean;
  /** Lay the open list out in a grid (e.g. 2 for color themes on wider screens). */
  columns?: 1 | 2;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const selected = options[selectedIndex];

  // Close when clicking anywhere else.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  // Keep the active option in view and focused in the list.
  useEffect(() => {
    if (!open) return;
    listRef.current?.focus({ preventScroll: true });
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  function show() {
    if (disabled) return;
    setActive(selectedIndex);
    setOpen(true);
  }
  function choose(i: number) {
    const option = options[i];
    if (option) onChange(option.value);
    setOpen(false);
    buttonRef.current?.focus();
  }

  function onButtonKey(e: KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      show();
    }
  }
  function onListKey(e: KeyboardEvent) {
    const last = options.length - 1;
    const step = columns;
    if (e.key === "ArrowDown") setActive((i) => Math.min(last, i + step));
    else if (e.key === "ArrowUp") setActive((i) => Math.max(0, i - step));
    else if (e.key === "ArrowRight" && columns > 1) setActive((i) => Math.min(last, i + 1));
    else if (e.key === "ArrowLeft" && columns > 1) setActive((i) => Math.max(0, i - 1));
    else if (e.key === "Home") setActive(0);
    else if (e.key === "End") setActive(last);
    else if (e.key === "Enter" || e.key === " ") choose(active);
    else if (e.key === "Escape" || e.key === "Tab") {
      setOpen(false);
      if (e.key === "Escape") buttonRef.current?.focus();
      return;
    } else if (e.key.length === 1 && /\S/.test(e.key)) {
      const ch = e.key.toLowerCase();
      const from = (active + 1) % options.length;
      const order = [...options.slice(from), ...options.slice(0, from)];
      const hit = order.find((o) => o.label.toLowerCase().startsWith(ch));
      if (hit) setActive(options.indexOf(hit));
    } else return;
    e.preventDefault();
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onButtonKey}
        className={`flex w-full items-center gap-3 rounded-2xl border bg-white px-3 py-2.5 text-left transition disabled:bg-cream ${
          open ? "border-rose ring-4 ring-rose/10" : "border-line hover:border-ink/30"
        }`}
      >
        <span className="min-w-0 flex-1">{selected?.render}</span>
        <Icon.chevronDown size={18} className={`shrink-0 text-ink-soft transition ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-labelledby={labelledBy}
          aria-activedescendant={`${listId}-${active}`}
          onKeyDown={onListKey}
          className={`lw-pop absolute inset-x-0 top-[calc(100%+0.4rem)] z-30 max-h-80 overflow-y-auto rounded-2xl bg-white p-1.5 shadow-[0_18px_40px_-12px_rgba(43,29,34,0.35)] ring-1 ring-line focus:outline-none ${
            columns === 2 ? "grid gap-1 sm:grid-cols-2" : "space-y-0.5"
          }`}
        >
          {options.map((o, i) => {
            const isSelected = i === selectedIndex;
            return (
              <li
                key={o.value}
                id={`${listId}-${i}`}
                data-index={i}
                role="option"
                aria-selected={isSelected}
                aria-label={o.label}
                onPointerEnter={() => setActive(i)}
                onClick={() => choose(i)}
                className={`flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 ${i === active ? "bg-petal" : ""}`}
              >
                <span className="min-w-0 flex-1">{o.render}</span>
                {isSelected && <Icon.check size={16} className="shrink-0 text-rose" aria-hidden />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
