// src/App.tsx
import { useMemo, useState, type ChangeEvent } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Badge } from "./components/ui/badge";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type Inputs = {
  term: number;
  amortTPMS: number;
  amortOther: number;
  units: number;
  arpu: number;
  upfrontPerUnit: number;
  capexTPMS: number;
  capexOther: number;
  capexInstall: number;
  airtime: number;
  thirdParty: number;
  mcfLicense: number;
  people: number;
  warranty: number;
  discountRate: number;
};

type Row = {
  month: number;
  revenue: number;
  cogs: number;
  grossMargin: number;
  depreciation: number;
  opex: number;
  operatingProfit: number;
  capexCash: number;
  upfrontCashIn: number;
  fcf: number;
  cumFCF: number;
};

const currency = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });

const pct = (n: number) =>
  (n * 100).toLocaleString(undefined, { maximumFractionDigits: 1 }) + "%";

function irr(cashflows: number[], guess = 0.1): number | null {
  const maxIter = 100;
  const eps = 1e-7;
  let r = guess / 12;
  for (let i = 0; i < maxIter; i++) {
    let npv = 0;
    let d = 0;
    for (let t = 0; t < cashflows.length; t++) {
      const cf = cashflows[t];
      const denom = (1 + r) ** t;
      npv += cf / denom;
      d -= (t * cf) / (denom * (1 + r));
    }
    const newR = r - npv / d;
    if (Number.isNaN(newR) || !Number.isFinite(newR)) return null;
    if (Math.abs(newR - r) < eps) {
      const annual = (1 + newR) ** 12 - 1;
      return annual;
    }
    r = newR;
  }
  return null;
}

function npv(cashflows: number[], annualDiscountRate: number): number {
  const r = annualDiscountRate / 12;
  let res = 0;
  for (let t = 0; t < cashflows.length; t++) {
    res += cashflows[t] / (1 + r) ** t;
  }
  return res;
}

function buildSchedule(i: Inputs): Row[] {
  const rows: Row[] = [];
  const term = i.term;

  const totalCapexPerUnit = i.capexTPMS + i.capexOther + i.capexInstall;
  const capexTotal = totalCapexPerUnit * i.units;
  const upfrontTotal = i.upfrontPerUnit * i.units;

  const monthlyDepTPMS = (i.capexTPMS * i.units) / Math.max(1, i.amortTPMS);
  const monthlyDepOther = (i.capexOther * i.units) / Math.max(1, i.amortOther);
  const monthlyDepInstall = (i.capexInstall * i.units) / Math.max(1, i.amortOther);

  const monthlyAmortUpfrontTPMS = (i.upfrontPerUnit * i.units * 0.5) / Math.max(1, i.amortTPMS);
  const monthlyAmortUpfrontOther = (i.upfrontPerUnit * i.units * 0.5) / Math.max(1, i.amortOther);

  const perUnitCOGS = i.airtime + i.thirdParty + i.mcfLicense + i.people + i.warranty;

  let cum = 0;
  for (let m = 0; m <= term; m++) {
    const isStart = m === 0;

    const recurringRevenue = i.arpu * i.units;
    const amortUpfront =
      (m > 0 && m <= i.amortTPMS ? monthlyAmortUpfrontTPMS : 0) +
      (m > 0 && m <= i.amortOther ? monthlyAmortUpfrontOther : 0);

    const revenue = m === 0 ? 0 : recurringRevenue + amortUpfront;

    const dep =
      (m > 0 && m <= i.amortTPMS ? monthlyDepTPMS : 0) +
      (m > 0 && m <= i.amortOther ? monthlyDepOther + monthlyDepInstall : 0);

    const cogsCash = m > 0 ? perUnitCOGS * i.units : 0;
    const cogs = cogsCash + dep;

    const grossMargin = revenue - cogs;
    const opex = 0;
    const operatingProfit = grossMargin - opex;

    const capexCash = isStart ? capexTotal : 0;
    const upfrontCashIn = isStart ? upfrontTotal : 0;

    const fcf = operatingProfit + dep - capexCash + upfrontCashIn;

    cum += fcf;

    rows.push({
      month: m,
      revenue,
      cogs,
      grossMargin,
      depreciation: dep,
      opex,
      operatingProfit,
      capexCash,
      upfrontCashIn,
      fcf,
      cumFCF: cum,
    });
  }
  return rows;
}

function keyMetrics(rows: Row[], discountRate: number) {
  const cf = rows.map((r) => r.fcf);
  const _npv = npv(cf, discountRate);
  const _irr = irr(cf) ?? null;

  let payback: number | null = null;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].cumFCF >= 0) {
      payback = i;
      break;
    }
  }

  const sumRev = rows.reduce((a, r) => a + r.revenue, 0);
  const sumCOGS = rows.reduce((a, r) => a + r.cogs, 0);
  const gmPct = sumRev > 0 ? (sumRev - sumCOGS) / sumRev : 0;

  return {
    npv: _npv,
    irr: _irr,
    payback,
    cumulativeFCF: rows[rows.length - 1]?.cumFCF ?? 0,
    grossMarginPct: gmPct,
  };
}

function NumberInput({
  label,
  value,
  step = 1,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  step?: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">
        {label} {suffix ? <span className="text-gray-400">{suffix}</span> : null}
      </label>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(Number(e.target.value))}
        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
      />
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState<"base">("base");

  const [inp, setInp] = useState<Inputs>({
    term: 36,
    amortTPMS: 24,
    amortOther: 24,
    units: 100,
    arpu: 20,
    upfrontPerUnit: 100,
    capexTPMS: 80,
    capexOther: 70,
    capexInstall: 30,
    airtime: 0.35,
    thirdParty: 0.2,
    mcfLicense: 0.25,
    people: 0.15,
    warranty: 0.05,
    discountRate: 0.1,
  });

  const rows = useMemo(() => buildSchedule(inp), [inp]);
  const metrics = useMemo(() => keyMetrics(rows, inp.discountRate), [rows, inp]);

  const chartData = useMemo(
    () =>
      rows.map((r) => ({
        monthLabel: `M${r.month}`,
        fcf: Math.round(r.fcf),
        cumulative: Math.round(r.cumFCF),
      })),
    [rows]
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          Enterprise Deal Economics <Badge>v1.2</Badge>
        </h1>
      </div>

      {/* Wrap Tabs to apply margin — Tabs doesn’t accept className */}
      <div className="mb-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as "base")}>
          <TabsList>
            <TabsTrigger value="base">Base Case</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Inputs — Base Case</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <NumberInput label="Term" suffix="mo" value={inp.term} onChange={(v) => setInp((s) => ({ ...s, term: v }))} />
              <NumberInput label="Units" value={inp.units} onChange={(v) => setInp((s) => ({ ...s, units: v }))} />
              <NumberInput label="ARPU" suffix="$/unit/mo" step={0.01} value={inp.arpu} onChange={(v) => setInp((s) => ({ ...s, arpu: v }))} />
              <NumberInput label="Upfront payment per unit" suffix="$" step={1} value={inp.upfrontPerUnit} onChange={(v) => setInp((s) => ({ ...s, upfrontPerUnit: v }))} />
              <NumberInput label="TPMS amortization" suffix="mo" value={inp.amortTPMS} onChange={(v) => setInp((s) => ({ ...s, amortTPMS: v }))} />
              <NumberInput label="Other HW amortization" suffix="mo" value={inp.amortOther} onChange={(v) => setInp((s) => ({ ...s, amortOther: v }))} />
              <NumberInput label="TPMS capex" suffix="$/unit" value={inp.capexTPMS} onChange={(v) => setInp((s) => ({ ...s, capexTPMS: v }))} />
              <NumberInput label="Other HW capex" suffix="$/unit" value={inp.capexOther} onChange={(v) => setInp((s) => ({ ...s, capexOther: v }))} />
              <NumberInput label="Install capex" suffix="$/unit" value={inp.capexInstall} onChange={(v) => setInp((s) => ({ ...s, capexInstall: v }))} />
              <NumberInput label="Airtime/data" suffix="$/unit/mo" step={0.01} value={inp.airtime} onChange={(v) => setInp((s) => ({ ...s, airtime: v }))} />
              <NumberInput label="3P license" suffix="$/unit/mo" step={0.01} value={inp.thirdParty} onChange={(v) => setInp((s) => ({ ...s, thirdParty: v }))} />
              <NumberInput label="MCF license" suffix="$/unit/mo" step={0.01} value={inp.mcfLicense} onChange={(v) => setInp((s) => ({ ...s, mcfLicense: v }))} />
              <NumberInput label="People" suffix="$/unit/mo" step={0.01} value={inp.people} onChange={(v) => setInp((s) => ({ ...s, people: v }))} />
              <NumberInput label="Warranty" suffix="$/unit/mo" step={0.01} value={inp.warranty} onChange={(v) => setInp((s) => ({ ...s, warranty: v }))} />
              <NumberInput label="Discount rate" suffix="% annual" step={0.01} value={Math.round(inp.discountRate * 10000) / 100} onChange={(v) => setInp((s) => ({ ...s, discountRate: v / 100 }))} />
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Base Case</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-6 md:grid-cols-5">
              <div><div className="text-xs text-gray-500">NPV</div><div className="text-base font-semibold">{currency(metrics.npv)}</div></div>
              <div><div className="text-xs text-gray-500">IRR (annual)</div><div className="text-base font-semibold">{metrics.irr == null ? "—" : pct(metrics.irr)}</div></div>
              <div><div className="text-xs text-gray-500">Cumulative FCF</div><div className="text-base font-semibold">{currency(metrics.cumulativeFCF)}</div></div>
              <div><div className="text-xs text-gray-500">Payback</div><div className="text-base font-semibold">{metrics.payback == null ? "—" : `${metrics.payback} mo`}</div></div>
              <div><div className="text-xs text-gray-500">Gross Margin</div><div className="text-base font-semibold">{pct(metrics.grossMarginPct)}</div></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Free Cash Flow — Monthly &amp; Cumulative</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="monthLabel" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="cumulative" name="Cumulative" stroke="#2563eb" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="fcf" name="FCF" stroke="#16a34a" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Monthly P&amp;L (accrual) &amp; FCF</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="py-2 pr-4">Month</th>
                    <th className="py-2 pr-4">Revenue</th>
                    <th className="py-2 pr-4">COGS</th>
                    <th className="py-2 pr-4">Gross Margin</th>
                    <th className="py-2 pr-4">Depreciation</th>
                    <th className="py-2 pr-4">Op Profit</th>
                    <th className="py-2 pr-4">Capex (Cash)</th>
                    <th className="py-2 pr-4">Upfront Cash</th>
                    <th className="py-2 pr-0">FCF</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.month} className="border-t">
                      <td className="py-2 pr-4">M{r.month}</td>
                      <td className="py-2 pr-4">{currency(r.revenue)}</td>
                      <td className="py-2 pr-4">{currency(r.cogs)}</td>
                      <td className="py-2 pr-4">{currency(r.grossMargin)}</td>
                      <td className="py-2 pr-4">{currency(r.depreciation)}</td>
                      <td className="py-2 pr-4">{currency(r.operatingProfit)}</td>
                      <td className="py-2 pr-4">{currency(r.capexCash)}</td>
                      <td className="py-2 pr-4">{currency(r.upfrontCashIn)}</td>
                      <td className="py-2 pr-0 font-medium">{currency(r.fcf)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
