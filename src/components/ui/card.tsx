import React from "react";

function cn(...cls: (string | undefined | false)[]) {
  return cls.filter(Boolean).join(" ");
}

export function Card({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={cn(
        "rounded-2xl border border-gray-200 bg-white shadow-sm",
        "dark:border-gray-800 dark:bg-gray-900",
        className
      )}
    />
  );
}

export function CardHeader({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={cn(
        "px-5 py-4 border-b border-gray-100 dark:border-gray-800",
        className
      )}
    />
  );
}

export function CardTitle({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={cn("text-sm font-semibold text-gray-900 dark:text-gray-100", className)}
    />
  );
}

export function CardContent({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={cn("px-5 py-5", className)} />;
}
