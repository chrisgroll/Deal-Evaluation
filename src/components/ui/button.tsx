import React from "react";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "ghost";
};

export function Button({ className = "", variant = "default", ...rest }: Props) {
  const base = "inline-flex items-center justify-center rounded-2xl px-3 py-2 text-sm font-medium transition";
  const styles =
    variant === "outline"
      ? "border bg-white hover:bg-gray-50"
      : variant === "ghost"
      ? "hover:bg-gray-100"
      : "bg-black text-white hover:bg-black/90";

  return <button className={`${base} ${styles} ${className}`} {...rest} />;
}