
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./components/ui/tabs";
import { Badge } from "./components/ui/badge";
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from "recharts";

/** Calculation helpers (matches your economics) */
function range(n: number) { return [...Array(n)].map((_, i) => i); }
function fmt(n: number) { return n.toLocaleString(undefined, { maximumFractionDigits: 0 }); }

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
  mcf: number;
  people: number;
  warranty: number;
  discount: number;
};

/** Default base case */
const DEFAULTS: Inputs = {
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
  mcf: 0.25,
  people: 0.15,
  warranty: 0.05,
  discount: 0.10,
};

export default function App() {
  const [tab, setTab] = useState("base");
  const [inp, setInp] = useState<Inputs>(DEFAULTS);

  /** computed model */
  const model = useMemo(() => {
    const months = inp.term;
    const upfrontCash = inp.upfrontPerUnit * inp.units;

    // Capex (cash outflow at start)
    const capexCash = (inp.capexTPMS + inp.capexOther + inp.capexInstall) * inp.units;

    // ARPU-recognized monthly revenue (straight-line, rev rec immediately)
    const revenueMo = inp.arpu * inp.units;

    // Monthly per-unit COGS items:
    const perUnitCOGS = inp.airtime + inp.thirdParty + inp.mcf + inp.people + inp.warranty;
    const cogsMoVariable = perUnitCOGS * inp.units;

    // Amortization (COGS) from capex
    const tpmsAmortMo = (inp.capexTPMS * inp.units) / inp.amortTPMS;
    const otherAmortMo = (inp.capexOther * inp.units) / inp.amortOther;
    const installAmortMo = 0; // install often expensed immediately; keep 0 here
    const amortMo = tpmsAmortMo + otherAmortMo + installAmortMo;

    // Depreciation add-back = amortMo
    const depreciationAddback = amortMo;

    // Monthly P&L & FCF
    let cumulative = 0;
    const monthly = range(months).map((m) => {
      const revenue = revenueMo;
      const cogs = cogsMoVariable + amortMo;
      const grossMargin = revenue - cogs;
      const opex = 0;
      const operatingProfit = grossMargin - opex;

      // FCF = operating profit + depreciation - capex (capex at m=0 only) + upfront cash (at m=0 only)
      const capexThisMonth = m === 0 ? capexCash : 0;
      const upfrontThisMonth = m === 0 ? upfrontCash : 0;
      const fcf = operatingProfit + depreciationAddback - capexThisMonth + upfrontThisMonth;

      cumulative += fcf;
      return {
        m: m + 1,
        revenue,
        cogs,
        grossMargin,
        operatingProfit,
        amort: amortMo,
        fcf,
        cumulative,
      };
    });

    const discountMo = Math.pow(1 + inp.discount, 1 / 12) - 1;
    const npv = monthly.reduce((acc, row, i) => acc + row.fcf / Math.pow(1 + discountMo, i + 1), 0);
    const cumFcf = monthly.reduce((a, r) => a + r.fcf, 0);
    const payback = monthly.findIndex((r) => r.cumulative >= 0) + 1 || null;
    const grossPct = monthly[0].revenue ? (monthly[0].grossMargin / monthly[0].revenue) * 100 : 0;

    return { monthly, npv, cumFcf, payback, grossPct };
  }, [inp]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex items-center gap-3">
          <h1 className="h1">Enterprise Deal Economics</h1>
          <Badge>v1.2</Badge>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="base">Base Case</TabsTrigger>
            <TabsTrigger value="scenario">Scenario</TabsTrigger>
          </TabsList>

          <TabsContent value="base">
            <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Inputs */}
              <Card className="lg:col-span-1">
                <CardHeader><CardTitle>Inputs — Base Case</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {([
                    ["Term (months)", "term"],
                    ["TPMS amortization (mo)", "amortTPMS"],
                    ["Other HW amortization (mo)", "amortOther"],
                    ["Units", "units"],
                    ["ARPU ($/unit/mo)", "arpu"],
                    ["Upfront payment per unit ($)", "upfrontPerUnit"],
                    ["TPMS capex ($/unit)", "capexTPMS"],
                    ["Other HW capex ($/unit)", "capexOther"],
                    ["Install capex ($/unit)", "capexInstall"],
                    ["Airtime/data ($/unit/mo)", "airtime"],
                    ["3P license ($/unit/mo)", "thirdParty"],
                    ["MCF license ($/unit/mo)", "mcf"],
                    ["People ($/unit/mo)", "people"],
                    ["Warranty ($/unit/mo)", "warranty"],
                    ["Discount rate (annual)", "discount"],
                  ] as const).map(([label, key]) => (
                    <div key={key}>
                      <div className="label">{label}</div>
                      <input
                        className="input"
                        type="number"
                        step="any"
                        value={(inp as any)[key]}
                        onChange={(e) => setInp((p) => ({ ...p, [key]: Number(e.target.value) }))}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Metrics */}
              <Card className="lg:col-span-1">
                <CardHeader><CardTitle>Base Case</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <div className="metric"><span>NPV</span><strong>${fmt(model.npv)}</strong></div>
                  <div className="metric"><span>Cumulative FCF</span><strong>${fmt(model.cumFcf)}</strong></div>
                  <div className="metric"><span>Payback</span><strong>{model.payback ? `${model.payback} mo` : "—"}</strong></div>
                  <div className="metric"><span>Gross Margin</span><strong>{model.grossPct.toFixed(1)}%</strong></div>
                  <div className="subtle">Rev-rec immediate; capex upfront; amortization in COGS.</div>
                </CardContent>
              </Card>

              {/* Chart */}
              <Card className="lg:col-span-1">
                <CardHeader><CardTitle>Free Cash Flow — Monthly & Cumulative</CardTitle></CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={model.monthly}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="m" tickFormatter={(t) => `M${t}`} />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="cumulative" name="Cumulative" stroke="#2563eb" strokeWidth={2} />
                      <Line type="monotone" dataKey="fcf" name="FCF" stroke="#16a34a" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Monthly P&L (accrual) & FCF */}
            <div className="mt-6">
              <Card>
                <CardHeader><CardTitle>Monthly P&L (accrual) & FCF</CardTitle></CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500">
                        <th className="py-2 pr-4">Month</th>
                        <th className="py-2 pr-4">Revenue</th>
                        <th className="py-2 pr-4">COGS</th>
                        <th className="py-2 pr-4">Gross Margin</th>
                        <th className="py-2 pr-4">Operating Profit</th>
                        <th className="py-2 pr-4">FCF</th>
                        <th className="py-2 pr-0">Cumulative</th>
                      </tr>
                    </thead>
                    <tbody>
                      {model.monthly.map((r) => (
                        <tr key={r.m} className="border-t">
                          <td className="py-2 pr-4">M{r.m}</td>
                          <td className="py-2 pr-4">${fmt(r.revenue)}</td>
                          <td className="py-2 pr-4">${fmt(r.cogs)}</td>
                          <td className="py-2 pr-4">${fmt(r.grossMargin)}</td>
                          <td className="py-2 pr-4">${fmt(r.operatingProfit)}</td>
                          <td className="py-2 pr-4">${fmt(r.fcf)}</td>
                          <td className="py-2 pr-0">${fmt(r.cumulative)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="scenario">
            <div className="subtle">
              You can clone the Base Case card set for scenario comparisons later. For now, Base Case is fully functional.
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
