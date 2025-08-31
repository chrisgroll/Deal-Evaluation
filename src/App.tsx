import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./components/ui/tabs";
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
  arpu: number;
  units: number;
  upfrontPerUnit: number;
  tpmsCapex: number;
  otherCapex: number;
  installCapex: number;
  amortTP: number;
  amortOT: number;
  airtime: number;
  thirdParty: number;
  mcf: number;
  people: number;
  warranty: number;
  discountRate: number;
};

const initial: Inputs = {
  term: 36,
  arpu: 20,
  units: 100,
  upfrontPerUnit: 100,
  tpmsCapex: 80,
  otherCapex: 70,
  installCapex: 30,
  amortTP: 24,
  amortOT: 24,
  airtime: 0.35,
  thirdParty: 0.2,
  mcf: 0.25,
  people: 0.15,
  warranty: 0.05,
  discountRate: 0.10,
};

function dollars(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export default function App() {
  const [tab, setTab] = useState("base");
  const [inp, setInp] = useState<Inputs>(initial);

  const {
    monthly,
    cumulative,
    npv,
    irr,
    payback,
    grossMargin,
    pnl,
  } = useMemo(() => computeDeal(inp), [inp]);

  const chartData = useMemo(
    () =>
      monthly.map((m, i) => ({
        m: `M${i + 1}`,
        fcf: m,
        cum: cumulative[i],
      })),
    [monthly, cumulative]
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">
            Enterprise Deal Economics <Badge>v1.2</Badge>
          </h1>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="base">Base Case</TabsTrigger>
              <TabsTrigger value="scenario">Scenario</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Inputs */}
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle>Inputs — Base Case</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Section label="Contract">
                <Number label="Term (months)" value={inp.term} onChange={(v) => setInp({ ...inp, term: v })} />
                <div className="grid grid-cols-2 gap-3">
                  <Number label="TPMS amortization (mo)" value={inp.amortTP} onChange={(v) => setInp({ ...inp, amortTP: v })} />
                  <Number label="Other HW amortization (mo)" value={inp.amortOT} onChange={(v) => setInp({ ...inp, amortOT: v })} />
                </div>
                <Number label="Units" value={inp.units} onChange={(v) => setInp({ ...inp, units: v })} />
                <Number label="ARPU ($/unit/mo)" value={inp.arpu} onChange={(v) => setInp({ ...inp, arpu: v })} />
                <Number label="Upfront payment per unit ($)" value={inp.upfrontPerUnit} onChange={(v) => setInp({ ...inp, upfrontPerUnit: v })} />
              </Section>

              <Section label="Capex (per unit)">
                <Number label="TPMS capex ($/unit)" value={inp.tpmsCapex} onChange={(v) => setInp({ ...inp, tpmsCapex: v })} />
                <Number label="Other HW capex ($/unit)" value={inp.otherCapex} onChange={(v) => setInp({ ...inp, otherCapex: v })} />
                <Number label="Install capex ($/unit)" value={inp.installCapex} onChange={(v) => setInp({ ...inp, installCapex: v })} />
              </Section>

              <Section label="COGS ($/unit/mo)">
                <div className="grid grid-cols-2 gap-3">
                  <Number label="Airtime/data" value={inp.airtime} step={0.01} onChange={(v) => setInp({ ...inp, airtime: v })} />
                  <Number label="3P license" value={inp.thirdParty} step={0.01} onChange={(v) => setInp({ ...inp, thirdParty: v })} />
                  <Number label="MCF license" value={inp.mcf} step={0.01} onChange={(v) => setInp({ ...inp, mcf: v })} />
                  <Number label="People" value={inp.people} step={0.01} onChange={(v) => setInp({ ...inp, people: v })} />
                  <Number label="Warranty" value={inp.warranty} step={0.01} onChange={(v) => setInp({ ...inp, warranty: v })} />
                </div>
              </Section>

              <Section label="Finance">
                <Number label="Discount rate (annual %)" value={inp.discountRate * 100} step={0.5}
                  onChange={(v) => setInp({ ...inp, discountRate: v / 100 })} />
              </Section>
            </CardContent>
          </Card>

          {/* Metrics */}
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle>Base Case</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="NPV" value={dollars(npv)} />
              <Row label="IRR (annual)" value={`${(irr * 100).toFixed(2)}%`} />
              <Row label="Cumulative FCF" value={dollars(cumulative[cumulative.length - 1])} />
              <Row label="Payback" value={`${payback ?? "—"} mo`} />
              <Row label="Gross Margin" value={`${(grossMargin * 100).toFixed(1)}%`} />
            </CardContent>
          </Card>

          {/* Chart */}
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle>Free Cash Flow — Monthly & Cumulative</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="m" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="cum" name="Cumulative" stroke="#2563eb" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="fcf" name="FCF" stroke="#16a34a" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* P&L table */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Monthly P&L (accrual) & FCF</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="py-2 pr-3">Line</th>
                  {Array.from({ length: inp.term }, (_, i) => (
                    <th key={i} className="py-2 pr-3">M{i + 1}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="[&>tr:nth-child(odd)]:bg-gray-50">
                {pnl.map((row) => (
                  <tr key={row.name}>
                    <td className="py-2 pr-3 font-medium">{row.name}</td>
                    {row.values.map((v, i) => (
                      <td key={i} className="py-2 pr-3 tabular-nums">{dollars(v)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ---------- Small UI helpers ---------- */
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      {children}
    </div>
  );
}

function Number({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  value: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="block text-xs text-gray-600">{label}</span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
      />
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-600">{label}</span>
      <span className="font-semibold text-gray-900">{value}</span>
    </div>
  );
}

/* ---------- Core finance ---------- */

function computeDeal(inp: Inputs) {
  const months = inp.term;
  const units = inp.units;

  // Capex totals
  const tpmsTotal = inp.tpmsCapex * units;
  const otherTotal = inp.otherCapex * units;
  const installTotal = inp.installCapex * units;

  const upfrontCash = inp.upfrontPerUnit * units;

  // Depreciation / amortization (COGS expensing of capex)
  const depTP = tpmsTotal / Math.max(1, inp.amortTP);
  const depOT = (otherTotal + installTotal) / Math.max(1, inp.amortOT);

  const rev = Array(months).fill(inp.arpu * units);
  const cogsRecurringPerUnit = inp.airtime + inp.thirdParty + inp.mcf + inp.people + inp.warranty;
  const cogsRecurring = Array(months).fill(cogsRecurringPerUnit * units);

  const cogsAmort = Array(months).fill(0).map((_, i) =>
    (i < inp.amortTP ? depTP : 0) + (i < inp.amortOT ? depOT : 0)
  );

  const cogs = cogsRecurring.map((v, i) => v + cogsAmort[i]);
  const grossProfit = cogs.map((v, i) => rev[i] - v);
  const grossMargin =
    grossProfit.reduce((a, b) => a + b, 0) / Math.max(1, rev.reduce((a, b) => a + b, 0));

  // Accrual operating profit (no OpEx beyond COGS in this simple model)
  const op = grossProfit.slice();

  // FCF = operating profit + depreciation addback - capex cash + upfront cash (month 1)
  // Here depreciation addback = amortized capex
  const depAddback = cogsAmort;
  const capexCash = Array(months).fill(0);
  capexCash[0] = -(tpmsTotal + otherTotal + installTotal); // upfront cash outflow

  const monthly = op.map((v, i) => v + depAddback[i] + capexCash[i] + (i === 0 ? upfrontCash : 0));
  const cumulative = monthly.reduce<number[]>((acc, cur) => {
    acc.push((acc[acc.length - 1] ?? 0) + cur);
    return acc;
  }, []);

  // Payback month (first month cumulative turns positive)
  const payIdx = cumulative.findIndex((x) => x >= 0);
  const payback = payIdx === -1 ? undefined : payIdx + 1;

  // NPV / IRR on monthly cash flows (discount rate annual -> monthly)
  const rMonthly = Math.pow(1 + inp.discountRate, 1 / 12) - 1;
  const npv =
    monthly.reduce((s, cf, i) => s + cf / Math.pow(1 + rMonthly, i + 1), 0);

  // Simple IRR via bisection on monthly basis
  const irrMonthly = solveIRR(monthly);
  const irr = Math.pow(1 + irrMonthly, 12) - 1;

  // P&L lines
  const pnl = [
    { name: "Revenue", values: rev },
    { name: "COGS (recurring)", values: cogsRecurring },
    { name: "COGS (amortization)", values: cogsAmort },
    { name: "Gross Profit", values: grossProfit },
    { name: "Operating Profit", values: op },
    { name: "FCF", values: monthly },
  ];

  return { monthly, cumulative, npv, irr, payback, grossMargin, pnl };
}

function solveIRR(flows: number[]) {
  let lo = -0.9, hi = 1.0;
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2;
    const npv = flows.reduce((s, cf, i) => s + cf / Math.pow(1 + mid, i + 1), 0);
    if (npv > 0) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
