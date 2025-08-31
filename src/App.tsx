import { useMemo, useState } from "react";
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

/** -----------------------
 * Finance helpers
 * ----------------------*/
const monthlyRateFromAnnual = (annualPct: number) => {
  const r = annualPct / 100;
  return Math.pow(1 + r, 1 / 12) - 1;
};

const npv = (rateMonthly: number, cashflows: number[]) =>
  cashflows.reduce((acc, cf, i) => acc + cf / Math.pow(1 + rateMonthly, i), 0);

// Simple IRR using Newton + fallback bisection
function irr(cashflows: number[], guessAnnual = 0.1): number | null {
  const f = (r: number) =>
    cashflows.reduce((acc, cf, t) => acc + cf / Math.pow(1 + r, t), 0);
  // work in monthly rate, then convert back to annual
  let r = Math.pow(1 + guessAnnual, 1 / 12) - 1;
  const df = (r: number) =>
    cashflows.reduce(
      (acc, cf, t) => acc + (-t * cf) / Math.pow(1 + r, t + 1),
      0
    );

  for (let i = 0; i < 30; i++) {
    const fr = f(r);
    const dfr = df(r);
    if (Math.abs(fr) < 1e-6) break;
    if (Math.abs(dfr) < 1e-12) break;
    r = r - fr / dfr;
    if (!isFinite(r)) break;
  }
  if (!isFinite(r)) {
    // fallback: bisection on [-0.9, 5%/mo]
    let lo = -0.9,
      hi = 0.05;
    for (let i = 0; i < 100; i++) {
      const mid = (lo + hi) / 2;
      const v = f(mid);
      if (Math.abs(v) < 1e-6) {
        r = mid;
        break;
      }
      const vlo = f(lo);
      if (v === 0) {
        r = mid;
        break;
      }
      if (vlo * v < 0) hi = mid;
      else lo = mid;
      r = mid;
    }
  }
  if (!isFinite(r)) return null;
  const annual = (Math.pow(1 + r, 12) - 1) * 100;
  return annual;
}

/** -----------------------
 * Types
 * ----------------------*/
type Inputs = {
  term: number; // months
  units: number;
  arpu: number; // $/unit/mo recurring revenue
  upfrontPerUnit: number; // $ upfront cash per unit (amortized in revenue)
  tpmsCapex: number; // $/unit
  otherCapex: number; // $/unit
  installCapex: number; // $/unit
  tpmsAmort: number; // months
  otherAmort: number; // months (also used for install)
  airtime: number; // $/unit/mo
  thirdParty: number; // $/unit/mo
  mcfLicense: number; // $/unit/mo
  people: number; // $/unit/mo
  warranty: number; // $/unit/mo
  discountAnnualPct: number; // % annual
};

type MonthRow = {
  m: number; // 0..term
  label: string; // M0..Mterm
  revenue: number; // accrual
  cogsRecurring: number; // airtime + 3P + mcf + people + warranty
  amortCOGS: number; // hardware+install amort
  grossProfit: number;
  operatingProfit: number; // same as gross (no opex line here)
  depreciationAddback: number; // amortCOGS addback for FCF
  capexCash: number; // cash out at t0
  upfrontCashIn: number; // cash in at t0
  fcf: number; // OP + dep - capex + upfront (at t0)
  cumFCF: number;
};

const dollars = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });

/** -----------------------
 * Core schedule builder
 * ----------------------*/
function buildSchedule(i: Inputs): MonthRow[] {
  const rows: MonthRow[] = [];
  const t = i.term;

  const perUnitRecurringCOGS =
    i.airtime + i.thirdParty + i.mcfLicense + i.people + i.warranty;

  const totalUnits = i.units;

  // cash at t0
  const capexCashT0 = totalUnits * (i.tpmsCapex + i.otherCapex + i.installCapex);
  const upfrontCashT0 = totalUnits * i.upfrontPerUnit;

  // monthly accrual revenue pieces
  const arpuRevenue = totalUnits * i.arpu;
  const upfrontAmortPerMonth =
    i.upfrontPerUnit > 0 && i.otherAmort > 0
      ? (totalUnits * i.upfrontPerUnit) / i.otherAmort
      : 0;

  // monthly COGS recurring
  const recurringCOGS = totalUnits * perUnitRecurringCOGS;

  // monthly amort/“depreciation” through COGS
  const tpmsAmortPerMonth =
    i.tpmsAmort > 0 ? (totalUnits * i.tpmsCapex) / i.tpmsAmort : 0;
  const otherAmortPerMonth =
    i.otherAmort > 0 ? (totalUnits * i.otherCapex) / i.otherAmort : 0;
  const installAmortPerMonth =
    i.otherAmort > 0 ? (totalUnits * i.installCapex) / i.otherAmort : 0;
  const amortCOGSPerMonth =
    tpmsAmortPerMonth + otherAmortPerMonth + installAmortPerMonth;

  let cum = 0;

  for (let m = 0; m <= t; m++) {
    const isT0 = m === 0;
    const label = `M${m}`;

    const revenue = isT0
      ? 0 // no accrual in M0 so the chart “jump” is cleaner; turn on if you prefer
      : arpuRevenue + upfrontAmortPerMonth;

    const cogsRecurring = isT0 ? 0 : recurringCOGS;
    const amortCOGS = isT0 ? 0 : amortCOGSPerMonth;

    const grossProfit = revenue - (cogsRecurring + amortCOGS);
    const operatingProfit = grossProfit;

    // FCF bridge: OP + “depr” addback - capex + upfront cash (t0 only)
    const depreciationAddback = amortCOGS;
    const capexCash = isT0 ? -capexCashT0 : 0;
    const upfrontCashIn = isT0 ? upfrontCashT0 : 0;

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

/** -----------------------
 * KPI summary
 * ----------------------*/
function summarize(rows: MonthRow[], discountAnnualPct: number) {
  const cash = rows.map((r) => r.fcf);
  const rMonthly = monthlyRateFromAnnual(discountAnnualPct);
  const kpiNPV = npv(rMonthly, cash);
  const kpiIRR = irr(cash);
  const kpiCum = rows[rows.length - 1]?.cumFCF ?? 0;

  // payback: first month where cumulative >= 0 (after t0)
  let payback: number | null = null;
  for (const r of rows) {
    if (r.m > 0 && r.cumFCF >= 0) {
      payback = r.m;
      break;
    }
  }

  // gross margin (average across months > 0 revenue)
  const rev = rows.slice(1).reduce((a, r) => a + r.revenue, 0);
  const cogs = rows
    .slice(1)
    .reduce((a, r) => a + (r.cogsRecurring + r.amortCOGS), 0);
  const gmPct = rev > 0 ? ((rev - cogs) / rev) * 100 : 0;

  return {
    npv: kpiNPV,
    irrAnnualPct: kpiIRR,
    cumFCF: kpiCum,
    paybackMonths: payback,
    grossMarginPct: gmPct,
  };
}

/** -----------------------
 * UI
 * ----------------------*/
export default function App() {
  const [inputs, setInputs] = useState<Inputs>({
    term: 36,
    units: 100,
    arpu: 20,
    upfrontPerUnit: 100,
    tpmsCapex: 80,
    otherCapex: 70,
    installCapex: 30,
    tpmsAmort: 24,
    otherAmort: 24, // also used for install + upfront amort
    airtime: 0.35,
    thirdParty: 0.2,
    mcfLicense: 0.25,
    people: 0.15,
    warranty: 0.05,
    discountAnnualPct: 10,
  });

  const rows = useMemo(() => buildSchedule(inputs), [inputs]);
  const kpi = useMemo(
    () => summarize(rows, inputs.discountAnnualPct),
    [rows, inputs.discountAnnualPct]
  );

  const chartData = rows.map((r) => ({
    name: r.label,
    fcf: r.fcf,
    cumulative: r.cumFCF,
  }));

  const annual = useMemo(() => {
    const years: {
      year: number;
      revenue: number;
      cogs: number;
      amort: number;
      gross: number;
      op: number;
      dep: number;
      fcf: number;
      cum: number;
    }[] = [];
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
      years.push({ year: y, revenue, cogs, amort, gross, op, dep, fcf, cum });
    }
    return years;
  }, [rows, inputs.term]);

  const handleNum = (key: keyof Inputs) => (e: any) =>
    setInputs((s) => ({ ...s, [key]: Number(e.target.value) || 0 }));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-4 py-5 flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-blue-600" />
          <h1 className="text-2xl font-semibold">
            Enterprise Deal Economics <span className="text-xs text-slate-500 align-middle">v1.2</span>
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Inputs */}
        <section className="lg:col-span-1">
          <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            <div className="border-b px-5 py-4">
              <h2 className="text-lg font-medium">Inputs — Base Case</h2>
            </div>
            <div className="px-5 py-5 grid grid-cols-1 gap-4">
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
                    onChange={handleNum(key)}
                    className="h-10 rounded-lg border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </label>
              ))}
            </div>
          </div>
        </section>

        {/* KPIs + Chart */}
        <section className="lg:col-span-2 grid gap-6">
          <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            <div className="px-5 py-4 border-b">
              <h3 className="text-lg font-medium">Key Deal Metrics</h3>
            </div>
            <ul className="px-5 py-5 grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              <li className="rounded-xl border border-slate-200 p-3">
                <div className="text-slate-500">NPV</div>
                <div className="text-lg font-semibold">{dollars(kpi.npv)}</div>
              </li>
              <li className="rounded-xl border border-slate-200 p-3">
                <div className="text-slate-500">IRR (annual)</div>
                <div className="text-lg font-semibold">
                  {kpi.irrAnnualPct == null
                    ? "—"
                    : `${kpi.irrAnnualPct.toFixed(2)}%`}
                </div>
              </li>
              <li className="rounded-xl border border-slate-200 p-3">
                <div className="text-slate-500">Cumulative FCF</div>
                <div className="text-lg font-semibold">{dollars(kpi.cumFCF)}</div>
              </li>
              <li className="rounded-xl border border-slate-200 p-3">
                <div className="text-slate-500">Payback</div>
                <div className="text-lg font-semibold">
                  {kpi.paybackMonths == null ? "—" : `${kpi.paybackMonths} mo`}
                </div>
              </li>
              <li className="rounded-xl border border-slate-200 p-3">
                <div className="text-slate-500">Gross Margin</div>
                <div className="text-lg font-semibold">
                  {kpi.grossMarginPct.toFixed(1)}%
                </div>
              </li>
            </ul>
          </div>

          <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            <div className="px-5 py-4 border-b">
              <h3 className="text-lg font-medium">
                Free Cash Flow — Monthly & Cumulative
              </h3>
            </div>
            <div className="h-[360px] px-4 py-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="cumulative"
                    name="Cumulative"
                    stroke="#2563eb"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="fcf"
                    name="FCF"
                    stroke="#16a34a"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Monthly P&L (time → columns) */}
          <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 overflow-x-auto">
            <div className="px-5 py-4 border-b">
              <h3 className="text-lg font-medium">Monthly P&amp;L (accrual) & FCF</h3>
            </div>
            <div className="px-5 py-5">
              <table className="min-w-[900px] text-sm">
                <thead>
                  <tr>
                    {["Line", ...rows.map((r) => r.label)].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-slate-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Revenue", ...rows.map((r) => dollars(r.revenue))],
                    ["COGS — recurring", ...rows.map((r) => dollars(r.cogsRecurring))],
                    ["COGS — amortization", ...rows.map((r) => dollars(r.amortCOGS))],
                    ["Gross Profit", ...rows.map((r) => dollars(r.grossProfit))],
                    ["Operating Profit", ...rows.map((r) => dollars(r.operatingProfit))],
                    ["Depreciation addback", ...rows.map((r) => dollars(r.depreciationAddback))],
                    ["Capex (cash)", ...rows.map((r) => dollars(r.capexCash))],
                    ["Upfront cash in", ...rows.map((r) => dollars(r.upfrontCashIn))],
                    ["Free Cash Flow", ...rows.map((r) => dollars(r.fcf))],
                    ["Cumulative FCF", ...rows.map((r) => dollars(r.cumFCF))],
                  ].map(([label, ...vals], idx) => (
                    <tr key={idx} className="border-t">
                      <td className="px-3 py-2 font-medium text-slate-700">{label as string}</td>
                      {(vals as string[]).map((v, i) => (
                        <td key={i} className="px-3 py-2 tabular-nums">{v}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Annual view */}
          <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 overflow-x-auto">
            <div className="px-5 py-4 border-b">
              <h3 className="text-lg font-medium">Annual P&amp;L + Cumulative + Common-Sized</h3>
            </div>
            <div className="px-5 py-5">
              <table className="min-w-[900px] text-sm">
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-left text-slate-500">Line</th>
                    {annual.map((y) => (
                      <th key={y.year} className="px-3 py-2 text-left text-slate-500">
                        Y{y.year}
                      </th>
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
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
