import React from "react";

export function Badge({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs ${className}`}>
      {children}
    </span>
  );
}
