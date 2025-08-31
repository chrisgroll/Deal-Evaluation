import React from "react";

export function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-blue-600/10 px-2 py-0.5 text-xs font-medium text-blue-700">
      {children}
    </span>
  );
}
