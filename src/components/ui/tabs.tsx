import React, { createContext, useContext } from "react";

type TabsCtx = { value: string; onChange: (v: string) => void };
const Ctx = createContext<TabsCtx | null>(null);

export function Tabs({
  value,
  onValueChange,
  children,
}: {
  value: string;
  onValueChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={{ value, onChange: onValueChange }}>{children}</Ctx.Provider>;
}

export function TabsList({ children }: { children: React.ReactNode }) {
  return <div className="tabs">{children}</div>;
}

export function TabsTrigger({ value, children }: { value: string; children: React.ReactNode }) {
  const ctx = useContext(Ctx)!;
  const active = ctx.value === value;
  return (
    <button
      className="tab-btn"
      data-active={active ? "true" : "false"}
      onClick={() => ctx.onChange(value)}
      type="button"
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, children }: { value: string; children: React.ReactNode }) {
  const ctx = useContext(Ctx)!;
  if (ctx.value !== value) return null;
  return <div className="mt-4">{children}</div>;
}
