import React from "react";

const TabsCtx = React.createContext<{ value: string; setValue: (v: string) => void } | null>(null);

export function Tabs({
  value,
  onValueChange,
  children,
}: {
  value: string;
  onValueChange: (v: string) => void;
  children: React.ReactNode;
}) {
  // consume props so TS doesn't flag them as unused
  const ctxValue = React.useMemo(() => ({ value, setValue: onValueChange }), [value, onValueChange]);
  return <TabsCtx.Provider value={ctxValue}>{children}</TabsCtx.Provider>;
}

export function TabsList({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex gap-2 border-b p-2 ${className}`}>{children}</div>;
}

export function TabsTrigger({ value, children }: { value: string; children: React.ReactNode }) {
  const ctx = React.useContext(TabsCtx)!;
  const active = ctx.value === value;
  return (
    <button
      type="button"
      className={`rounded-xl px-3 py-1 text-sm ${active ? "bg-black text-white" : "hover:bg-gray-100"}`}
      onClick={() => ctx.setValue(value)}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, children }: { value: string; children: React.ReactNode }) {
  const ctx = React.useContext(TabsCtx)!;
  if (ctx.value !== value) return null;
  return <div className="pt-3">{children}</div>;
}
