"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";

export default function CredentialsPage() {
  const [creds, setCreds] = useState<{ id: string; name: string; credential_type: string }[]>([]);

  useEffect(() => { api.getCredentials().then(setCreds).catch(console.error); }, []);

  return (
    <AppShell>
      <h2 className="text-xl font-bold mb-6">Credentials</h2>
      <div className="space-y-2">
        {creds.map((c) => (
          <Card key={c.id} className="p-3 flex justify-between">
            <span>{c.name}</span>
            <span className="text-muted text-sm">{c.credential_type}</span>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
