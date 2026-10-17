"use client";

/* eslint-disable @next/next/no-img-element -- media is pre-optimized and served via signed URLs */

import Link from "next/link";
import { memo, useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { preload } from "react-dom";
import type { RendererProps } from "../types";
import type { LoveflixData } from "./definition";
import { MemoryViewer, type Memory } from "./MemoryViewer";
import s from "./loveflix.module.css";

/**
 * Loveflix — trusted renderer.
 *
 *   intro     black screen, the red logo glows in and zooms away (CSS only, ~2.8s, skippable)
 *   profiles  "Who's watching?" — any profile leads to the same page
 *   home      header, hero (title, description, photo), "Trending Now" row of memories
 *
 * "Continue" opens the first memory in the viewer; "Go back" returns to the profiles
 * without replaying the intro. It never checks payment, access, editing, expiry or storage.
 */

type Screen = "intro" | "profiles" | "home";

const INTRO_MS = 2900;
const INTRO_REDUCED_MS = 1200;
const MEMORY_COUNT = 5;
const DEFAULT_LOGO = "LOVEFLIX";
const DEFAULT_PROFILES = ["You", "Me", "Us", "Forever"];
const DEFAULT_SUBTITLE = "Today's Top 10 Love Stories";
const DEFAULT_TAGS = ["Romance", "Memories", "Forever"];
/** Default avatar colors when no profile picture is set (photo-free, so always colored). */
const AVATAR_COLORS = ["#2f6fd6", "#e6b422", "#d2232a", "#2fa36b"];
const NAV = ["Home", "Series", "Movies", "Documentaries", "My List"];

export function LoveflixRenderer({ data, mode }: RendererProps<LoveflixData>) {
  const [screen, setScreen] = useState<Screen>("intro");
  const [profile, setProfile] = useState(0);
  const [viewer, setViewer] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const fields = data as Record<string, string | undefined>;

  // Start fetching the hero photo during the intro so the title page appears complete.
  if (data.hero_photo) preload(data.hero_photo, { as: "image", fetchPriority: "high" });

  const logo = data.logo_text?.trim() || DEFAULT_LOGO;
  const profiles = DEFAULT_PROFILES.map((fallback, i) => ({
    name: fields[`profile_name_${i + 1}`]?.trim() || fallback,
    photo: fields[`profile_photo_${i + 1}`],
    color: AVATAR_COLORS[i]!,
  }));
  const memories: Memory[] = Array.from({ length: MEMORY_COUNT }, (_, i) => ({
    title: fields[`memory_title_${i + 1}`]?.trim() || `Episode ${i + 1}`,
    photo: fields[`memory_photo_${i + 1}`],
    message: fields[`memory_message_${i + 1}`] ?? "",
  }));
  // On the live page only filled memories show; in the editor every slot shows (empty ones as placeholders).
  const shown = memories.flatMap((m, i) => (m.photo || mode !== "live" ? [i] : []));
  const viewable = memories.flatMap((m, i) => (m.photo ? [i] : []));

  /** Scroll the template's own scroller (preview frame) or the window back to the top. */
  const toTop = useCallback(() => {
    const scroller = rootRef.current?.closest<HTMLElement>("[data-lw-scroll]");
    if (scroller) scroller.scrollTop = 0;
    else window.scrollTo(0, 0);
  }, []);

  const finishIntro = useCallback(() => {
    setScreen((current) => (current === "intro" ? "profiles" : current));
  }, []);

  useEffect(() => {
    if (screen !== "intro") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(finishIntro, reduced ? INTRO_REDUCED_MS : INTRO_MS);
    return () => window.clearTimeout(timer);
  }, [screen, finishIntro]);

  function chooseProfile(i: number) {
    setProfile(i);
    setScreen("home");
    toTop();
  }

  function goBack() {
    setViewer(null);
    setScreen("profiles");
    toTop();
  }

  function openMemory(i: number, opener: HTMLElement | null) {
    if (!memories[i]?.photo) return;
    openerRef.current = opener;
    setViewer(i);
  }

  const closeViewer = useCallback(() => {
    setViewer(null);
    openerRef.current?.focus({ preventScroll: true });
  }, []);

  const tags = (data.show_tags ?? "")
    .split(/[,•·|]/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 3);

  return (
    <div
      ref={rootRef}
      className={s.root}
      data-screen={screen}
      data-photos={data.photo_mode === "color" ? "color" : "bw"}
    >
      {/* First child, so its sticky layer covers the visible screen at any scroll position. */}
      {screen === "home" && viewer !== null && (
        <MemoryViewer
          memories={memories}
          viewable={viewable}
          index={viewer}
          onIndex={setViewer}
          onClose={closeViewer}
          rootRef={rootRef}
        />
      )}

      {screen === "intro" && <Intro logo={logo} onSkip={finishIntro} />}

      {screen === "profiles" && (
        <section className={s.profiles} aria-labelledby="lf-who">
          <div className={s.profilesBar}>
            <Wordmark text={logo} className={s.profilesLogo} />
          </div>
          <div className={s.profilesBody}>
            <h1 id="lf-who" className={s.who}>
              Who&apos;s watching?
            </h1>
            <ul className={s.profileList}>
              {profiles.map((p, i) => (
                <li key={i}>
                  <button type="button" className={s.profile} onClick={() => chooseProfile(i)}>
                    <Avatar photo={p.photo} color={p.color} className={s.profileAvatar} />
                    <span className={s.profileName}>{p.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {screen === "home" && (
        <div className={s.home}>
          <header className={s.header}>
            <Wordmark text={logo} className={s.headerLogo} />
            <nav className={s.nav} aria-label="Sections">
              {NAV.map((item, i) => (
                <span key={item} className={i === 0 ? s.navCurrent : undefined} aria-current={i === 0 ? "page" : undefined}>
                  {item}
                </span>
              ))}
            </nav>
            <div className={s.tools}>
              <SearchIcon />
              <BellIcon />
              <button type="button" className={s.headerProfile} onClick={goBack} aria-label={`Switch profile (now ${profiles[profile]!.name})`}>
                <Avatar photo={profiles[profile]!.photo} color={profiles[profile]!.color} className={s.headerAvatar} />
              </button>
            </div>
          </header>

          <main>
            <section className={s.hero} aria-labelledby="lf-title">
              <div className={s.heroMedia}>
                {data.hero_photo ? (
                  <img className={`${s.heroPhoto} ${s.photo}`} src={data.hero_photo} alt="" fetchPriority="high" decoding="async" />
                ) : (
                  <span className={s.placeholder} aria-hidden />
                )}
              </div>
              <div className={s.heroText}>
                <div className={s.meta}>
                  <span className={s.top10} aria-label="Top 10">
                    <span>TOP</span>
                    <span>10</span>
                  </span>
                  <span className={s.match}>100% Match</span>
                  <span className={s.year}>{data.show_year?.trim() || String(new Date().getFullYear())}</span>
                </div>
                <h1 id="lf-title" className={s.title}>
                  {data.show_title}
                </h1>
                <p className={s.subtitle}>{data.show_subtitle?.trim() || DEFAULT_SUBTITLE}</p>
                <p className={s.description}>{data.show_description}</p>
                <ul className={s.tags} aria-label="Genres">
                  {(tags.length ? tags : DEFAULT_TAGS).map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
                <div className={s.actions}>
                  <button
                    type="button"
                    className={s.play}
                    onClick={(e) => openMemory(viewable[0] ?? 0, e.currentTarget)}
                    disabled={viewable.length === 0}
                  >
                    <PlayIcon />
                    Continue
                  </button>
                  <button type="button" className={s.back} onClick={goBack}>
                    Go back
                  </button>
                </div>
              </div>
            </section>

            <Trending memories={memories} shown={shown} onOpen={openMemory} />
          </main>

          <footer className={s.footer}>
            <p>Made with ♥ by Love, Written</p>
            <p>
              <Link href="/" target={mode === "preview" ? "_blank" : undefined} rel="noopener">
                Make a surprise for someone →
              </Link>
            </p>
          </footer>
        </div>
      )}
    </div>
  );
}

/* ─── Pieces ─────────────────────────────────────────────────────────────── */

function Intro({ logo, onSkip }: { logo: string; onSkip: () => void }) {
  return (
    <section className={s.intro} aria-label={`${logo} intro`}>
      <div className={s.introStage}>
        <span className={s.introLight} aria-hidden />
        <Wordmark text={logo} className={s.introLogo} />
      </div>
      <button type="button" className={s.skip} onClick={onSkip}>
        Skip Intro
      </button>
    </section>
  );
}

/**
 * The red logo: each letter is stretched a little more toward the ends, giving the
 * slightly curved "cinema screen" shape of a streaming-service wordmark.
 */
const Wordmark = memo(function Wordmark({ text, className }: { text: string; className?: string }) {
  const letters = Array.from(text.toUpperCase());
  const mid = (letters.length - 1) / 2;
  return (
    <span className={`${s.wordmark} ${className ?? ""}`} role="img" aria-label={text}>
      {letters.map((ch, i) => (
        <span key={i} aria-hidden style={{ "--k": mid ? Math.abs(i - mid) / mid : 0 } as CSSProperties}>
          {ch === " " ? " " : ch}
        </span>
      ))}
    </span>
  );
});

function Avatar({ photo, color, className }: { photo: string | undefined; color: string; className: string | undefined }) {
  return (
    <span className={`${s.avatar} ${className ?? ""}`} style={{ background: color }} aria-hidden>
      {photo ? (
        <img src={photo} alt="" decoding="async" />
      ) : (
        <svg viewBox="0 0 40 40" className={s.smile}>
          <circle cx="13" cy="15" r="2.6" fill="#fff" />
          <circle cx="27" cy="15" r="2.6" fill="#fff" />
          <path d="M10 24c5.5 6 14.5 6 20 0" stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none" />
        </svg>
      )}
    </span>
  );
}

function Trending({
  memories,
  shown,
  onOpen,
}: {
  memories: Memory[];
  shown: number[];
  onOpen: (i: number, opener: HTMLElement | null) => void;
}) {
  return (
    <section className={s.trending} aria-labelledby="lf-trending">
      <h2 id="lf-trending" className={s.rowTitle}>
        Trending Now
      </h2>
      <ul className={s.row}>
        {shown.map((i) => {
          const m = memories[i]!;
          return (
            <li key={i} className={s.tileItem}>
              <button
                type="button"
                className={s.tile}
                onClick={(e) => onOpen(i, e.currentTarget)}
                disabled={!m.photo}
                aria-label={`Open “${m.title}”`}
              >
                {m.photo ? (
                  <img className={s.photo} src={m.photo} alt="" loading="lazy" decoding="async" />
                ) : (
                  <span className={s.placeholder} aria-hidden />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={s.playIcon}>
      <path d="M6 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L7.5 3.64A1 1 0 0 0 6 4.5z" fill="currentColor" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={s.toolIcon}>
      <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="2.6" fill="none" />
      <path d="M15.5 15.5 21 21" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={s.toolIcon}>
      <path
        d="M12 2.5a1.6 1.6 0 0 0-1.6 1.6v.7A6.5 6.5 0 0 0 5.5 11v4.4L3.6 18v1h16.8v-1l-1.9-2.6V11a6.5 6.5 0 0 0-4.9-6.2v-.7A1.6 1.6 0 0 0 12 2.5zM9.6 20.2a2.4 2.4 0 0 0 4.8 0z"
        fill="currentColor"
      />
    </svg>
  );
}
