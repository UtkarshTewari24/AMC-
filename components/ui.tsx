import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export function Button({
  className,
  variant = "default",
  size = "md",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none",
        size === "sm" && "h-8 px-3 text-xs",
        size === "md" && "h-10 px-4 text-sm",
        size === "lg" && "h-12 px-6 text-base",
        variant === "default" &&
          "bg-accent hover:bg-accent-dim text-white shadow-lg shadow-accent/20",
        variant === "outline" &&
          "border border-navy-600 hover:border-accent-bright hover:text-accent-bright text-ink-dim",
        variant === "ghost" && "text-ink-dim hover:text-ink hover:bg-navy-800",
        variant === "danger" && "bg-bad/10 text-bad border border-bad/40 hover:bg-bad/20",
        className
      )}
      {...props}
    />
  );
}

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-navy-700 bg-navy-900 p-5",
        className
      )}
      {...props}
    />
  );
}

export function Badge({
  className,
  tone = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "default" | "good" | "bad" | "warn" | "accent";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border",
        tone === "default" && "border-navy-600 text-ink-dim",
        tone === "accent" && "border-accent/50 bg-accent/10 text-accent-bright",
        tone === "good" && "border-good/50 bg-good/10 text-good",
        tone === "bad" && "border-bad/50 bg-bad/10 text-bad",
        tone === "warn" && "border-warn/50 bg-warn/10 text-warn",
        className
      )}
      {...props}
    />
  );
}
