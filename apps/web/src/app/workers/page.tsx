"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";

export default function WorkersPage() {
  const [workers, setWorkers] = useState<{ id: string; name: string; status: string; labels: Record<string, string>; current_runs: number }[]>([]);

  useEffect(() => { api.getWorkers().then(setWorkers).catch(console.error); }, []);

  return (
    <AppShell>
      <h2 className="text-xl font-bold mb-6">Workers</h2>
      <div className="space-y-3">
        {workers.map((w) => (
          <Card key={w.id} className="p-4">
            <div className="flex justify-between">
              <div>
                <p className="font-medium">{w.name}</p>
                <p className="text-sm text-muted">{Object.entries(w.labels).map(([k,v]) => `${k}=${v}`).join(", ") || "no labels"}</p>
              </div>
              <div className="text-right text-sm">
                <p className={w.status === "online" ? "text-green-400" : "text-muted"}>{w.status}</p>
                <p className="text-muted">{w.current_runs} runs</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
