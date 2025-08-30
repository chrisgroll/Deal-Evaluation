import React from "react";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return <input className={`h-9 w-full rounded-xl border px-3 ${className}`} {...rest} />;
}
