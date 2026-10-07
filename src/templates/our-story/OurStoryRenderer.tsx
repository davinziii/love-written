"use client";

/* eslint-disable @next/next/no-img-element -- media is pre-optimized and served via signed URLs */

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { useHydrated } from "@/lib/client/useHydrated";
import type { RendererProps } from "../types";
import { getFont, getTheme, getTrack, themeVars } from "../styles";
import { formatLongDate, daysSince } from "../shared/dates";
import { useReveal } from "../shared/useReveal";
import { HeartIcon, MusicIcon, MutedIcon } from "../shared/icons";
import type { OurStoryData } from "./definition";
import s from "./our-story.module.css";

/**
 * Our Story — trusted renderer.
 *
 * Receives validated customer data and decides only how it looks and behaves.
 * It never checks payment, access, editing rights, expiry or storage.
 */
export function OurStoryRenderer({ data, mode }: RendererProps<OurStoryData>) {
  const [opened, setOpened] = useState(false);
  const introRef = useRef<HTMLElement>(null);
  const theme = getTheme(data.theme);
  const storyFont = getFont(data.story_font, "lora");
  const finalFont = getFont(data.final_font, "great_vibes");
  const track = getTrack(data.music);

  const memories = [
    { photo: data.memory_photo_1, text: data.memory_1, date: data.memory_date_1 },
    { photo: data.memory_photo_2, text: data.memory_2, date: data.memory_date_2 },
    { photo: data.memory_photo_3, text: data.memory_3, date: data.memory_date_3 },
  ].filter((m) => m.photo || m.text);

  function open() {
    setOpened(true);
    // Wait a frame so the story exists, then scroll it into view — inside the preview
    // frame (data-lw-scroll) or the window on the live page.
    requestAnimationFrame(() => {
      const target = introRef.current;
      if (!target) return;
      const scroller = target.closest<HTMLElement>("[data-lw-scroll]");
      const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (scroller) scroller.scrollTo({ top: target.offsetTop, behavior: smooth ? "smooth" : "auto" });
      else target.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
    });
  }

  return (
    <div className={s.root} style={themeVars(theme, storyFont, finalFont) as CSSProperties}>
      <Cover name={data.recipient_name} opened={opened} onOpen={open} />

      {opened && (
        <>
          <section ref={introRef} className={`${s.section} ${s.intro}`} aria-label="Introduction">
            <Reveal>
              <span className={s.eyebrow}>For {data.recipient_name}</span>
              <h2 className={`${s.heading} ${s.storyTitle}`}>{data.story_title || "Our Story"}</h2>
            </Reveal>
            {data.together_since && <SinceChip date={data.together_since} />}
            <Reveal>
              <p className={s.prose}>{data.intro_message}</p>
            </Reveal>
          </section>

          {memories.map((m, i) => (
            <Memory key={i} index={i} photo={m.photo} text={m.text} date={m.date} />
          ))}

          <Finale message={data.final_message} sender={data.sender_name} />

          <footer className={s.footer}>
            <p>Made with ♥ by Love, Written</p>
            <p style={{ marginTop: "0.4rem" }}>
              <Link href="/" target={mode === "preview" ? "_blank" : undefined} rel="noopener">
                Make a surprise for someone →
              </Link>
            </p>
          </footer>

          {track && <MusicToggle src={track.src} title={track.title} />}
        </>
      )}
    </div>
  );
}

function Cover({ name, opened, onOpen }: { name: string; opened: boolean; onOpen: () => void }) {
  return (
    <header className={s.cover}>
      {[8, 26, 47, 68, 88].map((left, i) => (
        <span
          key={left}
          className={s.drift}
          style={{ left: `${left}%`, animationDelay: `${i * -2.8}s`, scale: `${0.6 + (i % 3) * 0.3}` }}
          aria-hidden
        >
          <HeartIcon size={22} />
        </span>
      ))}
      <div>
        <span className={s.eyebrow}>A story for</span>
        <h1 className={`${s.heading} ${s.coverName}`}>{name}</h1>
        <Envelope />
        <button type="button" className={s.primaryButton} onClick={onOpen} aria-expanded={opened}>
          <HeartIcon size={18} />
          {opened ? "Read it again" : "Open your story"}
        </button>
      </div>
    </header>
  );
}

function Envelope() {
  return (
    <svg className={s.envelope} viewBox="0 0 220 150" aria-hidden>
      <rect x="4" y="10" width="212" height="136" rx="10" fill="var(--lw-surface)" />
      <path d="M4 20 L110 92 L216 20" fill="none" stroke="var(--lw-glow)" strokeWidth="3" />
      <path d="M4 146 L86 76 M216 146 L134 76" stroke="var(--lw-glow)" strokeWidth="2" />
      <circle cx="110" cy="90" r="22" fill="var(--lw-accent)" />
      <path
        d="M110 101c-9-6-14-11-14-16.5a6.5 6.5 0 0 1 14-3 6.5 6.5 0 0 1 14 3C124 90 119 95 110 101z"
        fill="var(--lw-accent-ink)"
      />
    </svg>
  );
}

function SinceChip({ date }: { date: string }) {
  // Day count depends on "today", so compute it only after hydration.
  const hydrated = useHydrated();
  const days = hydrated ? daysSince(date) : null;
  return (
    <span className={s.sinceChip}>
      <span>Since {formatLongDate(date)}</span>
      {days !== null && days > 0 && <span aria-hidden>·</span>}
      {days !== null && days > 0 && <span>{days.toLocaleString("en-US")} days of us</span>}
    </span>
  );
}

const CHAPTER_WORDS = ["One", "Two", "Three", "Four", "Five"];

function Memory({
  index,
  photo,
  text,
  date,
}: {
  index: number;
  photo?: string;
  text?: string;
  date?: string;
}) {
  return (
    <section
      className={`${s.chapter} ${photo && text ? s.chapterSplit : ""} ${photo && text && index % 2 === 1 ? s.chapterAlt : ""}`}
      aria-label={`Memory ${index + 1}`}
    >
      <div className={s.divider} aria-hidden>
        <HeartIcon size={16} />
      </div>
      <Reveal>
        <span className={`${s.eyebrow} ${s.chapterLabel}`}>Chapter {CHAPTER_WORDS[index] ?? index + 1}</span>
      </Reveal>
      {photo && (
        <Reveal>
          <figure className={`${s.polaroid} ${index % 2 === 0 ? s.tiltLeft : s.tiltRight}`}>
            <span className={s.tape} aria-hidden />
            <img
              className={s.photo}
              src={photo}
              alt={date ? `A memory from ${formatLongDate(date)}` : `Memory ${index + 1}`}
              loading={index === 0 ? "eager" : "lazy"}
              decoding="async"
            />
            {date && <figcaption className={s.caption}>{formatLongDate(date)}</figcaption>}
          </figure>
        </Reveal>
      )}
      {text && (
        <Reveal>
          <p className={`${s.prose} ${s.memoryText}`}>{text}</p>
        </Reveal>
      )}
    </section>
  );
}

function Finale({ message, sender }: { message: string; sender: string }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <section className={s.finale} aria-label="Final message" aria-live="polite">
      {!revealed ? (
        <Reveal>
          <span className={s.eyebrow}>And finally</span>
          <h2 className={s.heading} style={{ fontSize: "2rem", marginTop: "0.8rem" }}>
            One more thing…
          </h2>
          <button
            type="button"
            className={s.heartButton}
            onClick={() => setRevealed(true)}
            aria-label="Reveal the final message"
          >
            <HeartIcon size={44} />
          </button>
          <p className={s.eyebrow}>Tap the heart</p>
        </Reveal>
      ) : (
        <>
          {Array.from({ length: 14 }, (_, i) => (
            <span
              key={i}
              className={s.burst}
              style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 7) * 0.25}s` }}
              aria-hidden
            >
              <HeartIcon size={14 + ((i * 7) % 18)} />
            </span>
          ))}
          <p className={`${s.heading} ${s.finalMessage}`}>{message}</p>
          <div className={s.signature}>
            <p className={s.eyebrow}>With all my love,</p>
            <p className={s.signatureName}>{sender}</p>
          </div>
        </>
      )}
    </section>
  );
}

function Reveal({ children }: { children: ReactNode }) {
  const { ref, visible } = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className={`${s.reveal} ${visible ? s.visible : ""}`}>
      {children}
    </div>
  );
}

function MusicToggle({ src, title }: { src: string; title: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  // The story is opened by a tap, so the browser allows playback to start here.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.5;
    audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    return () => audio.pause();
  }, []);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) audio.play().then(() => setPlaying(true)).catch(() => undefined);
    else {
      audio.pause();
      setPlaying(false);
    }
  }

  return (
    <>
      <audio ref={audioRef} src={src} loop preload="none" />
      <button
        type="button"
        className={s.musicToggle}
        onClick={toggle}
        aria-label={playing ? `Pause music: ${title}` : `Play music: ${title}`}
      >
        {playing ? <MusicIcon /> : <MutedIcon />}
      </button>
    </>
  );
}
