"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, ArrowRight } from "lucide-react";
import { api, setToken } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.login(email, password);
      setToken(res.access_token);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de connexion");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 border-r border-border bg-card/30">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 border border-primary/25">
            <Activity className="h-6 w-6 text-primary" />
          </div>
          <span className="text-xl font-bold">RunFlow</span>
        </div>
        <div>
          <h2 className="text-4xl font-bold tracking-tight leading-tight">
            Automatisez vos jobs
            <span className="text-gradient"> sans friction</span>
          </h2>
          <p className="text-muted-foreground mt-4 text-lg max-w-md">
            Plateforme API-first pour déclencher, orchestrer et monitorer vos scripts Python, Bash et Ansible.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">Trigger → Job → Queue → Worker → Résultat</p>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <Card className="w-full max-w-md glow-primary border-primary/10">
          <CardHeader>
            <CardTitle>Connexion</CardTitle>
            <CardDescription>Accédez à votre espace d&apos;administration</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Connexion..." : "Se connecter"}
                {!loading && <ArrowRight className="h-4 w-4" />}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
