import { useMemo, useState, type PropsWithChildren } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

/* =============================================================================
   Minimal UI primitives (styled with Tailwind) – no external UI lib required.
============================================================================= */
function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

function Card({ className, children }: PropsWithChildren<{ className?: string }>) {
  return (
    <div className={cn(
      "rounded-2xl bg-white shadow-sm ring-1 ring-slate-200",
      className
    )}>
      {children}
    </div>
  );
}
function CardHeader({ className, children }: PropsWithChildren<{ className?: string }>) {
  return <div className={cn("px-5 py-4 border-b", className)}>{children}</div>;
}
function CardTitle({ children }: PropsWithChildren) {
  return <h3 className="text-lg font-medium">{children}</h3>;
}
function CardContent({ className, children }: PropsWithChildren<{ className?: string }>) {
  return <div className={cn("px-5 py-5", className)}>{children}</div>;
}

function Badge({ children }: PropsWithChildren) {
  return (
    <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-200">
      {children}
    </span>
  );
}

function Button({
  children,
  variant = "primary",
  className,
  ...rest
}: PropsWithChildren<{ variant?: "primary" | "ghost"; className?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>>) {
  const styles =
    variant === "primary"
      ? "bg-blue-600 text-white hover:bg-blue-700"
      : "bg-transparent text-slate-700 hover:bg-slate-100";
  return (
    <button
      className={cn(
        "h-10 rounded-lg px-4 text-sm font-medium shadow-sm transition",
        styles,
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

function Tabs({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1 ring-1 ring-inset ring-slate-200">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "h-8 rounded-lg px-3 text-sm font-medium transition",
              active
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                : "text-slate-600 hover:text-slate-800"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* =============================================================================
   Finance helpers
============================================================================= */
const dollars = (n: number) =>
  n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });

const monthlyRateFromAnnual = (annualPct: number) =>
  Math.pow(1 + annualPct / 100, 1 / 12) - 1;

const npv = (rateMonthly: number, cashflows: number[]) =>
  cashflows.reduce((acc, cf, i) => acc + cf / Math.pow(1 + rateMonthly, i), 0);

function irr(cashflows: number[], guessAnnual = 10): number | null {
  const f = (rm: number) =>
    cashflows.reduce((acc, cf, t) => acc + cf / Math.pow(1 + rm, t), 0);
  // Newton in monthly space
  let r = monthlyRateFromAnnual(guessAnnual);
  for (let i = 0; i < 30; i++) {
    const fr = f(r);
    let dfr = 0;
    for (let t = 0; t < cashflows.length; t++) {
      dfr += (-t * cashflows[t]) / Math.pow(1 + r, t + 1);
    }
    if (Math.abs(fr) < 1e-6 || Math.abs(dfr) < 1e-12) break;
    r = r - fr / dfr;
    if (!isFinite(r)) break;
  }
  if (!isFinite(r)) return null;
  return (Math.pow(1 + r, 12) - 1) * 100;
}

/* =============================================================================
   Types & core schedule
============================================================================= */
type Inputs = {
  term: number;
  units: number;
  arpu: number;
  upfrontPerUnit: number;
  tpmsCapex: number;
  otherCapex: number;
  installCapex: number;
  tpmsAmort: number;
  otherAmort: number;
  airtime: number;
  thirdParty: number;
  mcfLicense: number;
  people: number;
  warranty: number;
  discountAnnualPct: number;
};

type MonthRow = {
  m: number;
  label: string;
  revenue: number;
  cogsRecurring: number;
  amortCOGS: number;
  grossProfit: number;
  operatingProfit: number;
  depreciationAddback: number;
  capexCash: number;
  upfrontCashIn: number;
  fcf: number;
  cumFCF: number;
};

function buildSchedule(i: Inputs): MonthRow[] {
  const rows: MonthRow[] = [];
  const perUnitRecurringCOGS =
    i.airtime + i.thirdParty + i.mcfLicense + i.people + i.warranty;

  const monthlyRevenue = (units: number) => units * i.arpu;
  const monthlyUpfrontAmort =
    i.upfrontPerUnit > 0 && i.otherAmort > 0
      ? (i.upfrontPerUnit * i.units) / i.otherAmort
      : 0;

  const monthlyRecurringCOGS = i.units * perUnitRecurringCOGS;
  const amortTPMS = i.tpmsAmort ? (i.tpmsCapex * i.units) / i.tpmsAmort : 0;
  const amortOther = i.otherAmort ? (i.otherCapex * i.units) / i.otherAmort : 0;
  const amortInstall = i.otherAmort ? (i.installCapex * i.units) / i.otherAmort : 0;
  const amortTotal = amortTPMS + amortOther + amortInstall;

  const capexT0 = -i.units * (i.tpmsCapex + i.otherCapex + i.installCapex);
  const upfrontInT0 = i.units * i.upfrontPerUnit;

  let cum = 0;
  for (let m = 0; m <= i.term; m++) {
    const label = `M${m}`;
    const isT0 = m === 0;

    const revenue = isT0 ? 0 : monthlyRevenue(i.units) + monthlyUpfrontAmort;
    const cogsRecurring = isT0 ? 0 : monthlyRecurringCOGS;
    const amortCOGS = isT0 ? 0 : amortTotal;

    const grossProfit = revenue - (cogsRecurring + amortCOGS);
    const operatingProfit = grossProfit;
    const depreciationAddback = amortCOGS;
    const capexCash = isT0 ? capexT0 : 0;
    const upfrontCashIn = isT0 ? upfrontInT0 : 0;

    const fcf = operatingProfit + depreciationAddback + capexCash + upfrontCashIn;
    cum += fcf;

    rows.push({
      m,
      label,
      revenue,
      cogsRecurring,
      amortCOGS,
      grossProfit,
      operatingProfit,
      depreciationAddback,
      capexCash,
      upfrontCashIn,
      fcf,
      cumFCF: cum,
    });
  }
  return rows;
}

function summarize(rows: MonthRow[], discountAnnualPct: number) {
  const cash = rows.map((r) => r.fcf);
  const rMonthly = monthlyRateFromAnnual(discountAnnualPct);
  const kpiNPV = npv(rMonthly, cash);
  const kpiIRR = irr(cash);
  const kpiCum = rows.at(-1)?.cumFCF ?? 0;

  let payback: number | null = null;
  for (const r of rows) {
    if (r.m > 0 && r.cumFCF >= 0) {
      payback = r.m;
      break;
    }
  }

  const rev = rows.slice(1).reduce((a, r) => a + r.revenue, 0);
  const cogs = rows.slice(1).reduce((a, r) => a + r.cogsRecurring + r.amortCOGS, 0);
  const gmPct = rev > 0 ? ((rev - cogs) / rev) * 100 : 0;

  return { npv: kpiNPV, irrAnnualPct: kpiIRR, cumFCF: kpiCum, paybackMonths: payback, grossMarginPct: gmPct };
}

/* =============================================================================
   App – polished layout
============================================================================= */
export default function App() {
  const [scenario, setScenario] = useState<"base">("base");
  const [inputs, setInputs] = useState<Inputs>({
    term: 36,
    units: 100,
    arpu: 20,
    upfrontPerUnit: 100,
    tpmsCapex: 80,
    otherCapex: 70,
    installCapex: 30,
    tpmsAmort: 24,
    otherAmort: 24,
    airtime: 0.35,
    thirdParty: 0.2,
    mcfLicense: 0.25,
    people: 0.15,
    warranty: 0.05,
    discountAnnualPct: 10,
  });

  const rows = useMemo(() => buildSchedule(inputs), [inputs]);
  const kpi = useMemo(() => summarize(rows, inputs.discountAnnualPct), [rows, inputs.discountAnnualPct]);

  const chartData = rows.map((r) => ({ name: r.label, fcf: r.fcf, cumulative: r.cumFCF }));

  // Annual rollup
  const annual = useMemo(() => {
    const out: { year: number; revenue: number; cogs: number; amort: number; gross: number; op: number; dep: number; fcf: number; cum: number }[] = [];
    let cum = 0;
    for (let y = 1; y <= Math.ceil(inputs.term / 12); y++) {
      const start = (y - 1) * 12 + 1;
      const end = Math.min(y * 12, inputs.term);
      const slice = rows.filter((r) => r.m >= start && r.m <= end);
      const revenue = slice.reduce((a, r) => a + r.revenue, 0);
      const cogs = slice.reduce((a, r) => a + r.cogsRecurring, 0);
      const amort = slice.reduce((a, r) => a + r.amortCOGS, 0);
      const gross = revenue - (cogs + amort);
      const op = gross;
      const dep = amort;
      const fcf = slice.reduce((a, r) => a + r.fcf, 0);
      cum += fcf;
      out.push({ year: y, revenue, cogs, amort, gross, op, dep, fcf, cum });
    }
    return out;
  }, [rows, inputs.term]);

  const setNum = (key: keyof Inputs) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setInputs((s) => ({ ...s, [key]: Number(e.target.value) || 0 }));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* HEADER */}
      <header className="sticky top-0 z-30 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-4">
          <div className="h-8 w-8 rounded-xl bg-blue-600" />
          <div className="flex items-baseline gap-2">
            <h1 className="text-2xl font-semibold">Enterprise Deal Economics</h1>
            <Badge>v1.2</Badge>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <Tabs
              options={[{ value: "base", label: "Base Case" }]}
              value={scenario}
              onChange={(v) => setScenario(v as "base")}
            />
            <Button variant="ghost" className="hidden sm:inline-flex">Add scenario</Button>
            <Button variant="ghost" className="hidden sm:inline-flex">Reset</Button>
          </div>
        </div>
      </header>

      {/* BODY */}
      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-3">
        {/* Left: Inputs (sticky) */}
        <section className="lg:col-span-1 lg:self-start lg:sticky lg:top-[88px]">
          <Card>
            <CardHeader>
              <CardTitle>Inputs — Base Case</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4">
              {([
                ["Term (months)", "term"],
                ["TPMS amortization (mo)", "tpmsAmort"],
                ["Other HW amortization (mo)", "otherAmort"],
                ["Units", "units"],
                ["ARPU ($/unit/mo)", "arpu"],
                ["Upfront payment per unit ($)", "upfrontPerUnit"],
                ["TPMS capex ($/unit)", "tpmsCapex"],
                ["Other HW capex ($/unit)", "otherCapex"],
                ["Install capex ($/unit)", "installCapex"],
                ["Airtime/data ($/unit/mo)", "airtime"],
                ["3P license ($/unit/mo)", "thirdParty"],
                ["MCF license ($/unit/mo)", "mcfLicense"],
                ["People ($/unit/mo)", "people"],
                ["Warranty ($/unit/mo)", "warranty"],
                ["Discount rate (annual %)", "discountAnnualPct"],
              ] as [string, keyof Inputs][]).map(([label, key]) => (
                <label key={key} className="grid gap-1">
                  <span className="text-sm text-slate-600">{label}</span>
                  <input
                    value={inputs[key] as number}
                    onChange={setNum(key)}
                    className="h-10 rounded-lg border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </label>
              ))}
              <div className="pt-2">
                <Button onClick={() => null}>Recalculate</Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Right: KPIs, Chart, Tables */}
        <section className="lg:col-span-2 grid gap-6">
          {/* KPIs */}
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle>Key Deal Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="grid grid-cols-2 gap-4 md:grid-cols-5">
                {[
                  ["NPV", dollars(kpi.npv)],
                  ["IRR (annual)", kpi.irrAnnualPct == null ? "—" : `${kpi.irrAnnualPct.toFixed(2)}%`],
                  ["Cumulative FCF", dollars(kpi.cumFCF)],
                  ["Payback", kpi.paybackMonths == null ? "—" : `${kpi.paybackMonths} mo`],
                  ["Gross Margin", `${kpi.grossMarginPct.toFixed(1)}%`],
                ].map(([k, v]) => (
                  <li key={k} className="rounded-xl border border-slate-200 p-4">
                    <div className="text-sm text-slate-500">{k}</div>
                    <div className="text-lg font-semibold">{v}</div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Free Cash Flow — Monthly &amp; Cumulative</CardTitle>
            </CardHeader>
            <CardContent className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="cumulative" name="Cumulative" stroke="#2563eb" strokeWidth={2} />
                  <Line type="monotone" dataKey="fcf" name="FCF" stroke="#16a34a" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Monthly P&L */}
          <Card className="overflow-x-auto">
            <CardHeader>
              <CardTitle>Monthly P&amp;L (accrual) &amp; FCF</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="min-w-[960px] text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr>
                    {["Line", ...rows.map((r) => r.label)].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Revenue", rows.map((r) => dollars(r.revenue))],
                    ["COGS — recurring", rows.map((r) => dollars(r.cogsRecurring))],
                    ["COGS — amortization", rows.map((r) => dollars(r.amortCOGS))],
                    ["Gross Profit", rows.map((r) => dollars(r.grossProfit))],
                    ["Operating Profit", rows.map((r) => dollars(r.operatingProfit))],
                    ["Depreciation addback", rows.map((r) => dollars(r.depreciationAddback))],
                    ["Capex (cash)", rows.map((r) => dollars(r.capexCash))],
                    ["Upfront cash in", rows.map((r) => dollars(r.upfrontCashIn))],
                    ["Free Cash Flow", rows.map((r) => dollars(r.fcf))],
                    ["Cumulative FCF", rows.map((r) => dollars(r.cumFCF))],
                  ].map(([label, vals], rowIdx) => (
                    <tr key={rowIdx} className="border-t">
                      <td className="px-3 py-2 font-medium text-slate-700">{label as string}</td>
                      {(vals as string[]).map((v, i) => (
                        <td key={i} className="px-3 py-2 tabular-nums">{v}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Annual view */}
          <Card className="overflow-x-auto">
            <CardHeader>
              <CardTitle>Annual P&amp;L + Cumulative + Common-Sized</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="min-w-[960px] text-sm">
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-left text-slate-500">Line</th>
                    {annual.map((y) => (
                      <th key={y.year} className="px-3 py-2 text-left text-slate-500">Y{y.year}</th>
                    ))}
                    <th className="px-3 py-2 text-left text-slate-500">Total</th>
                    <th className="px-3 py-2 text-left text-slate-500">% of Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Revenue", annual.map((y) => y.revenue)],
                    ["COGS — recurring", annual.map((y) => y.cogs)],
                    ["COGS — amortization", annual.map((y) => y.amort)],
                    ["Gross Profit", annual.map((y) => y.gross)],
                    ["Operating Profit", annual.map((y) => y.op)],
                    ["Depreciation addback", annual.map((y) => y.dep)],
                    ["Free Cash Flow", annual.map((y) => y.fcf)],
                    ["Cumulative FCF", annual.map((y) => y.cum)],
                  ].map(([label, arr]) => {
                    const vals = arr as number[];
                    const total = vals.reduce((a, b) => a + b, 0);
                    const revTotal = annual.reduce((a, y) => a + y.revenue, 0) || 1;
                    const pct = (total / revTotal) * 100;
                    return (
                      <tr key={label as string} className="border-t">
                        <td className="px-3 py-2 font-medium text-slate-700">{label as string}</td>
                        {vals.map((v, i) => (
                          <td key={i} className="px-3 py-2 tabular-nums">{dollars(v)}</td>
                        ))}
                        <td className="px-3 py-2 tabular-nums">{dollars(total)}</td>
                        <td className="px-3 py-2">{pct.toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
