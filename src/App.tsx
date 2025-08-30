import { Card, CardHeader, CardTitle, CardContent } from "./components/ui/card";
import { Button } from "./components/ui/button";
import { Badge } from "./components/ui/badge";

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>
              UI sanity check <Badge className="ml-2">ok</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600">
              Tailwind + React + Vite are wired up. Replace this file with your Deal Evaluation app when ready.
            </p>
            <Button>Primary</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
