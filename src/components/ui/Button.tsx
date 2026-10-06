import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-rose text-white shadow-[0_10px_24px_-10px_rgba(196,72,106,0.7)] hover:bg-rose-deep",
  secondary: "bg-paper text-ink ring-1 ring-line hover:ring-ink/30",
  ghost: "text-ink-soft hover:text-ink hover:bg-petal",
  danger: "bg-danger text-white hover:bg-danger/90",
};

/**
 * Button with a built-in busy state. While `busy` it is disabled and shows a spinner,
 * which prevents double submissions from the UI side (the server is idempotent too).
 */
export function Button({
  variant = "primary",
  busy = false,
  busyLabel,
  className = "",
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; busy?: boolean; busyLabel?: string }) {
  return (
    <button
      {...rest}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={`lw-press inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-[0.95rem] font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
    >
      {busy && <Spinner />}
      {busy && busyLabel ? busyLabel : children}
    </button>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-4 w-4 rounded-full border-2 border-current border-r-transparent ${className}`}
      style={{ animation: "lw-spin 0.7s linear infinite" }}
    />
  );
}
