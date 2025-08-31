import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './components/ui/tabs';
import { Badge } from './components/ui/badge';
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Mock data for chart
const data = Array.from({ length: 36 }, (_, i) => ({
  month: `M${i + 1}`,
  fcf: Math.max(0, (i - 1) * 1500 - 5000),
  cumulative: Math.max(0, (i + 1) * 1500 - 5000),
}));

export default function App() {
  const [tab, setTab] = useState('base');

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-2xl font-bold mb-4">Enterprise Deal Economics <Badge>v1.2</Badge></h1>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="base">Base Case</TabsTrigger>
          <TabsTrigger value="scenario">Scenario</TabsTrigger>
        </TabsList>
        <TabsContent value="base">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Inputs Panel */}
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle>Inputs — Base Case</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm">Term (months)</label>
                  <input className="w-full border rounded p-2" type="number" defaultValue={36} />
                </div>
                <div>
                  <label className="block text-sm">Units</label>
                  <input className="w-full border rounded p-2" type="number" defaultValue={100} />
                </div>
                <div>
                  <label className="block text-sm">ARPU ($/mo)</label>
                  <input className="w-full border rounded p-2" type="number" defaultValue={20} />
                </div>
                <div>
                  <label className="block text-sm">Upfront payment per unit</label>
                  <input className="w-full border rounded p-2" type="number" defaultValue={100} />
                </div>
              </CardContent>
            </Card>

            {/* Metrics Panel */}
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle>Base Case</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p>NPV: <strong>$41,949.95</strong></p>
                <p>IRR (annual): <strong>613.86%</strong></p>
                <p>Cumulative FCF: <strong>$49,500.00</strong></p>
                <p>Payback: <strong>6 mo</strong></p>
                <p>Gross Margin: <strong>48.2%</strong></p>
              </CardContent>
            </Card>

            {/* Chart Panel */}
            <Card className="col-span-1 md:col-span-1">
              <CardHeader>
                <CardTitle>Free Cash Flow — Monthly & Cumulative</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="cumulative" stroke="#2563eb" strokeWidth={2} name="Cumulative" />
                    <Line type="monotone" dataKey="fcf" stroke="#16a34a" strokeWidth={2} name="FCF" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
