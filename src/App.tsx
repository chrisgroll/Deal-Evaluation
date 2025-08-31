import React, { useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./components/ui/tabs";
import { Badge } from "./components/ui/badge";

/** ---------- Helpers ---------- */

type Inputs = {
  termMonths: number;
  units: number;

  arpuMonthlyPerUnit: number;
  upfrontPaymentTotal: number;

  // CAPEX per unit (cash at t=0)
  tpmsCapexPerUnit: number;
  otherHwCapexPerUnit: number;
  installCapexPerUnit: number;

  // Amortization terms (months)
  tpmsAmortMonths: number;
  otherAmortMonths: number; // used for Other HW + Installation

  // Monthly COGS per unit
  airtimePerUnit: number;
  thirdPartyPerUnit: number;
  mcfLicensePerUnit: number;
  peoplePerUnit: number;
  warrantyPerUnit: number;

  discountRateAnnualPct: number; // for NPV/IRR
};

type MonthRow = {
  month: number; // 1..term
  revenue: number;
  cogsRecurring: number; // airtime + third + mcf + people + warranty (cash)
  amortTPMS: number; // non-cash, but in COGS
  amortOther: number; // includes install
  totalCOGS: number;
  grossMargin: number;
  grossMarginPct: number;
  operatingProfit: number;

  depreciationAddback: number; // amortTPMS + amortOther
  capexCash: number; // upfront at t=0 only, so 0 here
  upfrontCash: number; // upfront payment recognized as cash at t=0, so 0 here

  fcf: number; // per month
  cumFCF: number; // running total incl month 0
};

const clampNum = (n: number, min = 0) => (isFinite(n) ? Math.max(min, n) : min);

function monthlyRateFromAnnual(annual: number) {
  return Math.pow(1 + annual, 1 / 12) - 1;
}

function npv(rate: number, cashFlows: number[]) {
  // cashFlows[0] is month 0, cashFlows[1] month 1, etc.
  let v = 0;
  for (let t = 0; t < cashFlows.length; t++) {
    v += cashFlows[t] / Math.pow(1 + rate, t);
  }
  return v;
}

function irr(cashFlows: number[], guess = 0.1): number | null {
  // Bisection between -0.9999 and 10 (1000%/mo), 200 iterations
  let lo = -0.9999,
    hi = 10,
    mid = guess;
  const f = (r: number) => npv(r, cashFlows);
  let fLo = f(lo),
    fHi = f(hi);
  if (isNaN(fLo) || isNaN(fHi)) return null;
  if (fLo * fHi > 0) {
    // no sign change — fallback: scan
    let bestR = -0.9999,
      bestAbs = Math.abs(fLo);
    for (let r = -0.9; r <= 1; r += 0.01) {
      const v = Math.abs(f(r));
      if (v < bestAbs) {
        bestAbs = v;
        bestR = r;
      }
    }
    return bestR;
  }
  for (let i = 0; i < 200; i++) {
    mid = (lo + hi) / 2;
    const fMid = f(mid);
    if (Math.abs(fMid) < 1e-8) break;
    if (fLo * fMid <= 0) {
      hi = mid;
      fHi = fMid;
    } else {
      lo = mid;
      fLo = fMid;
    }
  }
  return mid;
}

/** ---------- UI Input Field ---------- */

function NumField({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  suffix = "",
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  step?: number;
  min?: number;
  suffix?: string;
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          value={Number.isFinite(value) ? value : 0}
          step={step}
          min={min}
          onChange={(e) => onChange(parseFloat(e.target.value || "0"))}
        />
        {suffix && <span className="text-xs text-gray-500">{suffix}</span>}
      </div>
    </div>
  );
}

/** ---------- Main App ---------- */

export default function App() {
  const [inp, setInp] = useState<Inputs>({
    termMonths: 36,
    units: 5_000,

    arpuMonthlyPerUnit: 2.5,
    upfrontPaymentTotal: 250_000,

    tpmsCapexPerUnit: 12,
    otherHwCapexPerUnit: 18,
    installCapexPerUnit: 10,

    tpmsAmortMonths: 24,
    otherAmortMonths: 24,

    airtimePerUnit: 0.35,
    thirdPartyPerUnit: 0.2,
    mcfLicensePerUnit: 0.25,
    peoplePerUnit: 0.15,
    warrantyPerUnit: 0.05,

    discountRateAnnualPct: 10,
  });

  const calc = useMemo(() => {
    // Derived basics
    const n = clampNum(inp.termMonths, 1);
    const units = clampNum(inp.units, 0);
    const monthlyRecurringRevenue = units * inp.arpuMonthlyPerUnit;

    // Upfront payment — accrual (revenue) recognized evenly over otherAmortMonths (cap with term)
    const upfrontRecognMonths = Math.min(n, clampNum(inp.otherAmortMonths, 1));
    const upfrontRevenuePerMonth = inp.upfrontPaymentTotal / upfrontRecognMonths;

    // CAPEX cash (month 0)
    const capexTPMS = units * inp.tpmsCapexPerUnit;
    const capexOther = units * inp.otherHwCapexPerUnit;
    const capexInstall = units * inp.installCapexPerUnit;
    const totalCapexCash = capexTPMS + capexOther + capexInstall;

    // Amortization (non-cash COGS)
    const amortTPMSMonthly = capexTPMS / clampNum(inp.tpmsAmortMonths, 1);
    const amortOtherMonthly = (capexOther + capexInstall) / clampNum(inp.otherAmortMonths, 1);

    // Recurring COGS cash per month
    const recurringCOGSPerUnit =
      inp.airtimePerUnit + inp.thirdPartyPerUnit + inp.mcfLicensePerUnit + inp.peoplePerUnit + inp.warrantyPerUnit;
    const recurringCOGSMonthly = units * recurringCOGSPerUnit;

    // Build month 0 cash flow + months 1..n rows
    const rows: MonthRow[] = [];
    const cashFlows: number[] = [];
    let cumFCF = 0;

    // Month 0 cash: upfront payment inflow - capex outflow
    const cashM0 = inp.upfrontPaymentTotal - totalCapexCash;
    cumFCF += cashM0;
    cashFlows.push(cashM0); // t=0

    for (let m = 1; m <= n; m++) {
      const revenue = monthlyRecurringRevenue + (m <= upfrontRecognMonths ? upfrontRevenuePerMonth : 0);

      const amortTP = m <= inp.tpmsAmortMonths ? amortTPMSMonthly : 0;
      const amortOT = m <= inp.otherAmortMonths ? amortOtherMonthly : 0;

      const cogsRecurring = recurringCOGSMonthly;
      const totalCOGS = cogsRecurring + amortTP + amortOT;

      const grossMargin = revenue - totalCOGS;
      const grossMarginPct = revenue > 0 ? grossMargin / revenue : 0;

      const operatingProfit = grossMargin; // no OpEx beyond COGS in this model

      const depreciationAddback = amortTP + amortOT;
      const capexCash = 0; // only at t=0
      const upfrontCash = 0; // only at t=0

      // Monthly FCF here equals operating profit + non-cash addback.
      const fcfMonthly = operatingProfit + depreciationAddback;

      cumFCF += fcfMonthly;
      cashFlows.push(fcfMonthly);

      rows.push({
        month: m,
        revenue,
        cogsRecurring,
        amortTPMS: amortTP,
        amortOther: amortOT,
        totalCOGS,
        grossMargin,
        grossMarginPct,
        operatingProfit,
        depreciationAddback,
        capexCash,
        upfrontCash,
        fcf: fcfMonthly,
        cumFCF,
      });
    }

    // Deal metrics
    const rMonthly = monthlyRateFromAnnual(inp.discountRateAnnualPct / 100);
    const dealNPV = npv(rMonthly, cashFlows);
    const dealIRR = irr(cashFlows);
    const cumFCFEnd = rows.length ? rows[rows.length - 1].cumFCF : cashM0;

    // Payback month (first month where cumulative >= 0)
    let payback: number | null = null;
    let running = cashM0;
    if (running >= 0) {
      payback = 0;
    } else {
      for (let i = 0; i < rows.length; i++) {
        running += rows[i].fcf;
        if (running >= 0) {
          payback = rows[i].month;
          break;
        }
      }
    }

    // Annual aggregation
    const years = Math.ceil(n / 12);
    type Annual = {
      year: number;
      revenue: number;
      cogsRecurring: number;
      amort: number;
      totalCOGS: number;
      grossMargin: number;
      grossMarginPct: number;
      operatingProfit: number;
      fcf: number;
      cumRevenue: number;
    };
    const annual: Annual[] = [];
    let cumRev = 0;

    for (let y = 0; y < years; y++) {
      const start = y * 12;
      const end = Math.min(start + 12, rows.length);
      const slice = rows.slice(start, end);
      const revenue = sum(slice.map((r) => r.revenue));
      const cogsRecurring = sum(slice.map((r) => r.cogsRecurring));
      const amort = sum(slice.map((r) => r.amortTPMS + r.amortOther));
      const totalCOGS = sum(slice.map((r) => r.totalCOGS));
      const grossMargin = revenue - totalCOGS;
      const grossMarginPct = revenue > 0 ? grossMargin / revenue : 0;
      const operatingProfit = sum(slice.map((r) => r.operatingProfit));
      const fcf = sum(slice.map((r) => r.fcf));
      cumRev += revenue;
      annual.push({
        year: y + 1,
        revenue,
        cogsRecurring,
        amort,
        totalCOGS,
        grossMargin,
        grossMarginPct,
        operatingProfit,
        fcf,
        cumRevenue: cumRev,
      });
    }

    return {
      rows,
      cashM0,
      npv: dealNPV,
      irrMonthly: dealIRR,
      irrAnnual: dealIRR != null ? Math.pow(1 + dealIRR, 12) - 1 : null,
      paybackMonths: payback,
      cumulativeFcf: cumFCFEnd,
      annual,
    };
  }, [inp]);

  function set<K extends keyof Inputs>(key: K, v: number) {
    setInp((prev) => ({ ...prev, [key]: isFinite(v) ? v : 0 }));
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-[1200px] space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Enterprise Deal Evaluator</h1>
          <Badge className="ml-2">v1</Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Inputs</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <NumField label="Term (months)" value={inp.termMonths} onChange={(n) => set("termMonths", n)} />
            <NumField label="Units" value={inp.units} onChange={(n) => set("units", n)} />
            <NumField label="ARPU (per unit / mo)" value={inp.arpuMonthlyPerUnit} onChange={(n) => set("arpuMonthlyPerUnit", n)} step={0.01} />
            <NumField label="Upfront Payment (total)" value={inp.upfrontPaymentTotal} onChange={(n) => set("upfrontPaymentTotal", n)} step={100} />

            <NumField label="TPMS HW CAPEX / unit" value={inp.tpmsCapexPerUnit} onChange={(n) => set("tpmsCapexPerUnit", n)} step={0.01} />
            <NumField label="Other HW CAPEX / unit" value={inp.otherHwCapexPerUnit} onChange={(n) => set("otherHwCapexPerUnit", n)} step={0.01} />
            <NumField label="Installation CAPEX / unit" value={inp.installCapexPerUnit} onChange={(n) => set("installCapexPerUnit", n)} step={0.01} />
            <NumField label="TPMS Amort (mo)" value={inp.tpmsAmortMonths} onChange={(n) => set("tpmsAmortMonths", n)} />

            <NumField label="Other HW Amort (mo)" value={inp.otherAmortMonths} onChange={(n) => set("otherAmortMonths", n)} />
            <NumField label="Airtime / unit / mo" value={inp.airtimePerUnit} onChange={(n) => set("airtimePerUnit", n)} step={0.01} />
            <NumField label="3rd Party / unit / mo" value={inp.thirdPartyPerUnit} onChange={(n) => set("thirdPartyPerUnit", n)} step={0.01} />
            <NumField label="MCF License / unit / mo" value={inp.mcfLicensePerUnit} onChange={(n) => set("mcfLicensePerUnit", n)} step={0.01} />

            <NumField label="People / unit / mo" value={inp.peoplePerUnit} onChange={(n) => set("peoplePerUnit", n)} step={0.01} />
            <NumField label="Warranty / unit / mo" value={inp.warrantyPerUnit} onChange={(n) => set("warrantyPerUnit", n)} step={0.01} />
            <NumField
              label="Discount rate (annual %)"
              value={inp.discountRateAnnualPct}
              onChange={(n) => set("discountRateAnnualPct", n)}
              step={0.1}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Key Deal Metrics</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Metric label="NPV" value={calc.npv} fmt="currency" />
            <Metric label="IRR (annual)" value={calc.irrAnnual} fmt="pct" />
            <Metric label="Payback (months)" value={calc.paybackMonths} fmt="int" />
            <Metric label="Cumulative FCF" value={calc.cumulativeFcf} fmt="currency" />
          </CardContent>
        </Card>

        <Tabs value={"monthly"} onValueChange={() => {}}>
          <TabsList>
            <TabsTrigger value="monthly">Monthly P&amp;L</TabsTrigger>
            <TabsTrigger value="annual">Annual P&amp;L</TabsTrigger>
          </TabsList>

          <TabsContent value="monthly">
            <Card>
              <CardHeader>
                <CardTitle>Monthly P&amp;L (horizontal)</CardTitle>
              </CardHeader>
              <CardContent>
                <HorizontalTable rows={calc.rows} cashM0={calc.cashM0} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="annual">
            <Card>
              <CardHeader>
                <CardTitle>Annual P&amp;L (with common-size and cumulative revenue)</CardTitle>
              </CardHeader>
              <CardContent>
                <AnnualTable items={calc.annual} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

/** ---------- Metric Chip ---------- */

function Metric({ label, value, fmt = "currency" }: { label: string; value: number | null; fmt?: "currency" | "pct" | "int" }) {
  let disp = "-";
  if (value != null) {
    if (fmt === "currency") disp = formatCurrency(value);
    else if (fmt === "pct") disp = `${(value * 100).toFixed(2)}%`;
    else disp = String(Math.round(value));
  }
  return (
    <div className="rounded-2xl border p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-semibold">{disp}</div>
    </div>
  );
}

/** ---------- Monthly Horizontal Table ---------- */

function HorizontalTable({ rows, cashM0 }: { rows: MonthRow[]; cashM0: number }) {
  const headers = ["", ...rows.map((r) => `M${r.month}`), "Total"];

  const total = (key: keyof MonthRow) => sum(rows.map((r) => r[key] as number));

  const totals = {
    revenue: total("revenue"),
    cogsRecurring: total("cogsRecurring"),
    amort: total("amortTPMS") + total("amortOther"),
    totalCOGS: total("totalCOGS"),
    grossMargin: total("grossMargin"),
    operatingProfit: total("operatingProfit"),
    fcf: cashM0 + total("fcf"),
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[900px] w-full text-sm">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="border px-2 py-1 text-left font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <Row label="Revenue" values={[...rows.map((r) => r.revenue), totals.revenue]} />
          <Row label="COGS - Recurring (cash)" values={[...rows.map((r) => r.cogsRecurring), totals.cogsRecurring]} />
          <Row label="COGS - Amort TPMS (non-cash)" values={[...rows.map((r) => r.amortTPMS), total("amortTPMS")]} />
          <Row label="COGS - Amort Other (non-cash)" values={[...rows.map((r) => r.amortOther), total("amortOther")]} />
          <Row label="Total COGS" values={[...rows.map((r) => r.totalCOGS), totals.totalCOGS]} />
          <Row label="Gross Margin" values={[...rows.map((r) => r.grossMargin), totals.grossMargin]} />
          <Row
            label="Gross Margin %"
            values={[...rows.map((r) => r.grossMarginPct * 100), (totals.grossMargin / Math.max(1, totals.revenue)) * 100]}
            fmt="pct"
          />
          <Row label="Operating Profit" values={[...rows.map((r) => r.operatingProfit), totals.operatingProfit]} />
          <tr>
            <td className="border px-2 py-1 font-medium">Cash @ M0</td>
            <td className="border px-2 py-1 text-right">{formatCurrency(cashM0)}</td>
            <td className="border px-2 py-1 text-right" colSpan={rows.length - 1}></td>
            <td className="border px-2 py-1 text-right"></td>
          </tr>
          <Row label="FCF (monthly)" values={[...rows.map((r) => r.fcf), totals.fcf]} />
          <Row label="Cumulative FCF" values={[cashM0, ...rows.map((r) => r.cumFCF), cashM0 + total("fcf")]} />
        </tbody>
      </table>
    </div>
  );
}

/** ---------- Annual Table with Common-Size ---------- */

function AnnualTable({
  items,
}: {
  items: {
    year: number;
    revenue: number;
    cogsRecurring: number;
    amort: number;
    totalCOGS: number;
    grossMargin: number;
    grossMarginPct: number;
    operatingProfit: number;
    fcf: number;
    cumRevenue: number;
  }[];
}) {
  const headers = [
    "Year",
    "Revenue",
    "COGS Recurring",
    "Amort (non-cash)",
    "Total COGS",
    "GM",
    "GM %",
    "Op Profit",
    "FCF",
    "Cum Revenue",
    "COGS % Rev",
    "Op % Rev",
  ];
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[1000px] w-full text-sm">
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} className="border px-2 py-1 text-left font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((y) => {
            const cogsPct = y.revenue > 0 ? (y.totalCOGS / y.revenue) * 100 : 0;
            const opPct = y.revenue > 0 ? (y.operatingProfit / y.revenue) * 100 : 0;
            return (
              <tr key={y.year}>
                <td className="border px-2 py-1">Y{y.year}</td>
                <Cell money>{y.revenue}</Cell>
                <Cell money>{y.cogsRecurring}</Cell>
                <Cell money>{y.amort}</Cell>
                <Cell money>{y.totalCOGS}</Cell>
                <Cell money>{y.grossMargin}</Cell>
                <Cell pct>{y.grossMarginPct * 100}</Cell>
                <Cell money>{y.operatingProfit}</Cell>
                <Cell money>{y.fcf}</Cell>
                <Cell money>{y.cumRevenue}</Cell>
                <Cell pct>{cogsPct}</Cell>
                <Cell pct>{opPct}</Cell>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** ---------- Small Table Components ---------- */

function Row({ label, values, fmt = "money" }: { label: string; values: number[]; fmt?: "money" | "pct" }) {
  return (
    <tr>
      <td className="border px-2 py-1 font-medium">{label}</td>
      {values.map((v, i) => (
        <td key={i} className="border px-2 py-1 text-right">
          {fmt === "pct" ? `${v.toFixed(2)}%` : formatCurrency(v)}
        </td>
      ))}
    </tr>
  );
}

function Cell({
  children,
  money,
  pct,
}: {
  children: React.ReactNode;
  money?: boolean;
  pct?: boolean;
}) {
  const v = Number(children as any);
  return <td className="border px-2 py-1 text-right">{money ? formatCurrency(v) : pct ? `${v.toFixed(2)}%` : v}</td>;
}

/** ---------- Utils ---------- */

function sum(arr: number[]) {
  return arr.reduce((a, b) => a + b, 0);
}

function formatCurrency(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}
