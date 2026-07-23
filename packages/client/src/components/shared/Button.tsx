import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "tertiary" | "ghost" | "ready" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-gradient-to-r from-[#ef5b68] to-[#d94655] text-white shadow-lg shadow-[rgba(239,91,104,0.28)] hover:-translate-y-0.5 hover:shadow-xl",
  secondary: "bg-[#4c6ef5] text-white hover:-translate-y-0.5",
  tertiary:
    "bg-[var(--panel-2)] text-[var(--ink)] border border-[var(--line)] hover:-translate-y-0.5 hover:border-[#34c77b]",
  ghost: "bg-[var(--panel-2)] text-[var(--ink)] border border-[var(--line)]",
  ready:
    "bg-[var(--panel-2)] text-[var(--ink)] border border-[var(--line)]",
  danger: "bg-transparent text-[var(--ink-dim)] font-bold hover:text-[#ef5b68]",
};

const sizeClasses: Record<Size, string> = {
  sm: "px-3 py-2 text-xs",
  md: "px-4 py-3 text-sm",
  lg: "px-5 py-4 text-base",
};

export default function Button({
  variant = "tertiary",
  size = "md",
  className = "",
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const disabledClasses = disabled
    ? "opacity-40 cursor-not-allowed !transform-none !shadow-none"
    : "cursor-pointer";

  return (
    <button
      className={`
        border-none rounded-xl font-bold transition-all duration-180 ease-out
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${disabledClasses}
        ${className}
      `}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  );
}
