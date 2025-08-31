import { useMemo, useState } from "react";
import {
  LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

/** ------- Small UI helpers (no 3rd-party UI) ------- */
function Card(props: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl bg-white shadow-sm ring-1 ring-slate-200 ${props.className ?? ""}`}>
      {props.title ? (
        <div className="px-5 py-4 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-900">{props.title}</h3>
        </div>
      ) : null}
      <div className="p-5">{props.children}</div>
    </div>
  );
}
function KPI({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}
function NumberInput({
  label, value, onChange, suffix, step = 1, min = 0,
}: {
  label: string; value: number; onChange: (v: number) => void; suffix?: string; step?: number; min?: number;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-xs text-slate-600">{label}</span>
      <div className="relative">
        <input
          type="number"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          value={Number.isFinite(value) ? value : 0}
          step={step}
          min={min}
          onChange={(e) => onChange(parseFloat(e.target.value || "0"))}
        />
        {suffix ? <span className="pointer-events-none absolute inset-y-0 right-3 my-auto text-xs text-slate-500">{suffix}</span> : null}
      </div>
    </label>
  );
}

/** ------- App ------- */
export default function App() {
  // Inputs (keep names close to what you already had)
  const [term, setTerm] = useState(36);
  const [amortTPMS, setAmortTPMS] = useState(24);
  const [amortOther, setAmortOther] = useState(24);
  const [units, setUnits] = useState(100);
  const [arpu, setArpu] = useState(20);
  const [upfrontPerUnit, setUpfrontPerUnit] = useState(100);

  // Capex / Opex (per unit)
  const [tpmsCapex, setTpmsCapex] = useState(80);
  const [otherCapex, setOtherCapex] = useState(70);
  const [installCapex, setInstallCapex] = useState(30);
  const [airtime, setAirtime] = useState(0.35);
  const [thirdParty, setThirdParty] = useState(0.2);
  const [mcfLicense, setMcfLicense] = useState(0.25);
  const [people, setPeople] = useState(0.15);
  const [warranty, setWarranty] = useState(0.05);

  const discountRate = 0.10; // 10% as you requested

  /**
   * Simple accrual model:
   * - Revenue recognized immediately (no deferral)
   * - Upfront cash per unit amortized (TPMS/Other amort terms)
   * - Capex is cash outflow at M1; COGS recognizes depreciation via amort terms
   * - Opex (airtime/3P/MCF/people/warranty) purely monthly COGS
   * - FCF = OpProfit + depreciation addback − capex cash + upfront cash
   */
  const result = useMemo(() => {
    const months = Array.from({ length: term }, (_, i) => i + 1);

    const upfrontCash = upfrontPerUnit * units;                // cash at M1
    const capexCash = (tpmsCapex + otherCapex + installCapex) * units; // cash at M1

    const tpmsDep = tpmsCapex * units / Math.max(1, amortTPMS);
    const otherDep = otherCapex * units / Math.max(1, amortOther);
    const installDep = installCapex * units / Math.max(1, amortOther); // assume "other" schedule

    const monthlyRevenue = arpu * units;
    const monthlyCOGS = (airtime + thirdParty + mcfLicense + people + warranty) * units;

    const monthlyDep = tpmsDep + otherDep + installDep;

    // Build month stream
    const rows = months.map((m) => {
      const revenue = monthlyRevenue;
      const cogs = monthlyCOGS + monthlyDep;
      const grossMargin = revenue - cogs;
      const opProfit = grossMargin; // no opex here beyond COGS in this simple model

      const addback = monthlyDep; // depreciation addback
      const capexOut = m === 1 ? capexCash : 0;
      const upfrontIn = m === 1 ? upfrontCash : 0;

      const fcf = opProfit + addback - capexOut + upfrontIn;
      return { m, revenue, cogs, grossMargin, opProfit, fcf };
    });

    // Cumulative & NPV/IRR approximations (simple)
    let cum = 0;
    const chart = rows.map((r) => {
      cum += r.fcf;
      return { month: `M${r.m}`, fcf: Math.round(r.fcf), cumulative: Math.round(cum) };
    });

    const cumFCF = cum;

    // Payback (first month where cumulative >= 0)
    let payback: number | null = null;
    let running = 0;
    rows.forEach((r) => {
      running += r.fcf;
      if (payback == null && running >= 0) payback = r.m;
    });

    // NPV of FCF
    const npv = rows.reduce((acc, r, idx) => acc + r.fcf / Math.pow(1 + discountRate / 12, idx + 1), 0);

    // IRR (monthly) via simple secant; guard for weird cases
    const irr = (() => {
      const f = (rate: number) => rows.reduce((acc, r, idx) => acc + r.fcf / Math.pow(1 + rate, idx + 1), 0);
      let r0 = 0.01, r1 = 0.5;
      for (let i = 0; i < 30; i++) {
        const f0 = f(r0), f1 = f(r1);
        const denom = (f1 - f0);
        if (Math.abs(denom) < 1e-9) break;
        const r2 = r1 - f1 * (r1 - r0) / denom;
        r0 = r1;
        r1 = r2;
        if (!Number.isFinite(r1)) break;
      }
      const monthly = Math.max(-0.999, Math.min(5, r1));
      const annual = (1 + monthly) ** 12 - 1;
      return { monthly, annual };
    })();

    // Avg gross margin %
    const gmPct = rows.reduce((a, r) => a + (r.grossMargin / (r.revenue || 1)), 0) / rows.length;

    return {
      rows,
      chart,
      npv,
      irrAnnual: irr.annual,
      cumFCF,
      payback,
      grossMarginPct: gmPct,
    };
  }, [
    term, amortTPMS, amortOther, units, arpu, upfrontPerUnit,
    tpmsCapex, otherCapex, installCapex, airtime, thirdParty, mcfLicense, people, warranty,
  ]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">Enterprise Deal Economics</h1>
          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-200">v1.2</span>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Inputs */}
        <Card title="Inputs — Base Case" className="lg:col-span-1">
          <div className="grid grid-cols-2 gap-3">
            <NumberInput label="Term (months)" value={term} onChange={setTerm} />
            <div />
            <NumberInput label="TPMS amortization (mo)" value={amortTPMS} onChange={setAmortTPMS} />
            <NumberInput label="Other HW amortization (mo)" value={amortOther} onChange={setAmortOther} />
            <NumberInput label="Units" value={units} onChange={setUnits} />
            <NumberInput label="ARPU ($/unit/mo)" value={arpu} onChange={setArpu} />
            <NumberInput label="Upfront per unit ($)" value={upfrontPerUnit} onChange={setUpfrontPerUnit} />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <NumberInput label="TPMS capex ($/unit)" value={tpmsCapex} onChange={setTpmsCapex} />
            <NumberInput label="Other HW capex ($/unit)" value={otherCapex} onChange={setOtherCapex} />
            <NumberInput label="Install capex ($/unit)" value={installCapex} onChange={setInstallCapex} />
            <NumberInput label="Airtime/data ($/unit/mo)" value={airtime} onChange={setAirtime} step={0.01} />
            <NumberInput label="3P license ($/unit/mo)" value={thirdParty} onChange={setThirdParty} step={0.01} />
            <NumberInput label="MCF license ($/unit/mo)" value={mcfLicense} onChange={setMcfLicense} step={0.01} />
            <NumberInput label="People ($/unit/mo)" value={people} onChange={setPeople} step={0.01} />
            <NumberInput label="Warranty ($/unit/mo)" value={warranty} onChange={setWarranty} step={0.01} />
          </div>
        </Card>

        {/* KPIs */}
        <Card title="Base Case" className="lg:col-span-1">
          <div className="grid gap-1.5">
            <KPI label="NPV" value={result.npv.toLocaleString("en-US", { style: "currency", currency: "USD" })} />
            <KPI label="IRR (annual)" value={`${(result.irrAnnual * 100).toFixed(2)}%`} />
            <KPI label="Cumulative FCF" value={result.cumFCF.toLocaleString("en-US", { style: "currency", currency: "USD" })} />
            <KPI label="Payback" value={result.payback ? `${result.payback} mo` : "—"} />
            <KPI label="Gross Margin" value={`${(result.grossMarginPct * 100).toFixed(1)}%`} />
          </div>
        </Card>

        {/* Chart */}
        <Card title="Free Cash Flow — Monthly & Cumulative" className="lg:col-span-1">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={result.chart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(v: any) => v.toLocaleString()} />
                <Legend />
                <Line type="monotone" dataKey="cumulative" stroke="#2563eb" strokeWidth={2} name="Cumulative" />
                <Line type="monotone" dataKey="fcf" stroke="#16a34a" strokeWidth={2} name="FCF" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Monthly P&L (accrual) → FCF */}
        <Card title="Monthly P&L (accrual) & FCF" className="lg:col-span-3">
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-2">
              <thead>
                <tr className="text-xs text-slate-500">
                  <th className="text-left px-2 py-1">Month</th>
                  <th className="text-right px-2 py-1">Revenue</th>
                  <th className="text-right px-2 py-1">COGS</th>
                  <th className="text-right px-2 py-1">Gross Margin</th>
                  <th className="text-right px-2 py-1">Op Profit</th>
                  <th className="text-right px-2 py-1">FCF</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r) => (
                  <tr key={r.m} className="bg-slate-50/60 hover:bg-slate-100">
                    <td className="px-2 py-1 text-sm text-slate-700">{`M${r.m}`}</td>
                    <td className="px-2 py-1 text-right tabular-nums">
                      {r.revenue.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums">
                      {r.cogs.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums">
                      {r.grossMargin.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums">
                      {r.opProfit.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums font-semibold text-slate-900">
                      {r.fcf.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </main>
    </div>
  );
}
