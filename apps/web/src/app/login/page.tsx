"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, ArrowRight, Sparkles } from "lucide-react";
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
      <div className="hidden lg:flex lg:w-[52%] flex-col justify-between p-12 xl:p-16 border-r border-border relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/12 border border-accent/25">
            <Activity className="h-6 w-6 text-accent" />
          </div>
          <span className="text-xl font-bold tracking-tight">RunFlow</span>
        </div>
        <div className="relative max-w-lg">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs text-primary mb-6">
            <Sparkles className="h-3.5 w-3.5" />
            API-first automation
          </div>
          <h2 className="text-4xl xl:text-5xl font-bold tracking-tight leading-[1.15]">
            Automatisez vos jobs
            <span className="text-gradient"> sans friction</span>
          </h2>
          <p className="text-muted-foreground mt-5 text-lg leading-relaxed">
            Déclenchez, orchestrez et monitorer vos scripts Python, Bash et Ansible depuis une interface unifiée.
          </p>
          <div className="flex flex-wrap gap-3 mt-8 text-xs text-muted-foreground">
            {["Trigger", "Queue", "Worker", "Résultat"].map((step, i) => (
              <span key={step} className="flex items-center gap-2">
                {i > 0 && <span className="text-border">→</span>}
                <span className="rounded-md bg-card/80 border border-border px-2.5 py-1 font-medium">{step}</span>
              </span>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-muted-foreground">Self-hosted · Workers distants · Git natif</p>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <Card className="w-full max-w-md glow-primary border-primary/15 bg-card/95">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl">Connexion</CardTitle>
            <CardDescription>Accédez à votre espace d&apos;administration</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
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
              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? "Connexion…" : "Se connecter"}
                {!loading && <ArrowRight className="h-4 w-4" />}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
