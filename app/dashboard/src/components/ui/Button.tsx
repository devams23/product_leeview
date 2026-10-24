import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-btn font-medium whitespace-nowrap select-none transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-signal text-signal-ink hover:bg-[#E2FF6E]",
  secondary: "bg-ink-2 text-text-1 border border-line-2 hover:bg-ink-3 hover:border-white/20",
  ghost: "bg-ink-2 text-text-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)] hover:bg-ink-3 hover:text-text-1",
  danger: "bg-danger-soft text-danger border border-danger/30 hover:bg-danger/20",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-sm",
};

/** Class string for button-styled links (router Link or <a>). */
export function buttonClass(variant: ButtonVariant = "secondary", size: ButtonSize = "md", extra = "") {
  return [base, variants[variant], sizes[size], extra].filter(Boolean).join(" ");
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children?: ReactNode;
}

export function Button({ variant, size, className, type = "button", ...rest }: ButtonProps) {
  return <button type={type} className={buttonClass(variant, size, className)} {...rest} />;
}
