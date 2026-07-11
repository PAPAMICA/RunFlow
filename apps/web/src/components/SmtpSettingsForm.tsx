"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Send, XCircle } from "lucide-react";
import { api, SmtpConfigResponse } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

export function SmtpSettingsForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [source, setSource] = useState<SmtpConfigResponse["source"]>("none");
  const [passwordSet, setPasswordSet] = useState(false);

  const [enabled, setEnabled] = useState(false);
  const [host, setHost] = useState("");
  const [port, setPort] = useState(587);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [useTls, setUseTls] = useState(true);

  const [testRecipient, setTestRecipient] = useState("");
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    api
      .getSmtpConfig()
      .then((cfg) => {
        setSource(cfg.source);
        setPasswordSet(cfg.password_set);
        setEnabled(cfg.enabled);
        setHost(cfg.host);
        setPort(cfg.port);
        setUsername(cfg.username);
        setFromEmail(cfg.from_email);
        setUseTls(cfg.use_tls);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Erreur de chargement"))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const cfg = await api.updateSmtpConfig({
        enabled,
        host,
        port,
        username,
        password: password || undefined,
        from_email: fromEmail,
        use_tls: useTls,
      });
      setSource(cfg.source);
      setPasswordSet(cfg.password_set);
      setPassword("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur d'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    if (!testRecipient) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.testSmtpConfig(testRecipient);
      setTestResult(res);
    } catch (e) {
      setTestResult({ success: false, message: e instanceof Error ? e.message : "Erreur" });
    } finally {
      setTesting(false);
    }
  }

  if (loading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-5">
      {source === "env" && (
        <p className="text-xs text-muted-foreground rounded-lg bg-primary/5 border border-primary/20 px-3 py-2">
          La configuration actuelle provient des variables d&apos;environnement du serveur
          (SMTP_*). Enregistrer ci-dessous créera une configuration propre à votre organisation
          qui prendra le dessus.
        </p>
      )}

      <label className="flex items-center gap-2.5 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-4 w-4 accent-primary"
        />
        <span className="font-medium">Activer l&apos;envoi d&apos;emails via ce serveur SMTP</span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Serveur SMTP (hôte)</Label>
          <Input value={host} onChange={(e) => setHost(e.target.value)} placeholder="smtp.example.com" />
        </div>
        <div className="space-y-1.5">
          <Label>Port</Label>
          <Input
            type="number"
            value={port}
            onChange={(e) => setPort(Number(e.target.value) || 0)}
            placeholder="587"
          />
        </div>
        <div className="space-y-1.5 flex flex-col justify-end">
          <label className="flex items-center gap-2.5 text-sm cursor-pointer h-10">
            <input
              type="checkbox"
              checked={useTls}
              onChange={(e) => setUseTls(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            <span>STARTTLS</span>
          </label>
        </div>
        <div className="space-y-1.5">
          <Label>Nom d&apos;utilisateur</Label>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="user@example.com" autoComplete="off" />
        </div>
        <div className="space-y-1.5">
          <Label>Mot de passe</Label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={passwordSet ? "•••••••• (inchangé)" : "Mot de passe SMTP"}
            autoComplete="new-password"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Adresse d&apos;expéditeur (From)</Label>
          <Input
            value={fromEmail}
            onChange={(e) => setFromEmail(e.target.value)}
            placeholder="RunFlow <noreply@example.com>"
          />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Enregistrement…" : "Enregistrer"}
        </Button>
        {saved && (
          <span className="inline-flex items-center gap-1 text-sm text-success">
            <CheckCircle2 className="h-4 w-4" />
            Enregistré
          </span>
        )}
      </div>

      <div className="border-t border-border pt-4 space-y-3">
        <div>
          <p className="text-sm font-medium">Envoyer un email de test</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Utilise la configuration enregistrée. Pensez à enregistrer vos modifications avant de tester.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="email"
            value={testRecipient}
            onChange={(e) => setTestRecipient(e.target.value)}
            placeholder="destinataire@example.com"
            className="max-w-xs"
          />
          <Button variant="outline" onClick={handleTest} disabled={testing || !testRecipient}>
            <Send className="h-4 w-4" />
            {testing ? "Envoi…" : "Tester"}
          </Button>
        </div>
        {testResult && (
          <p
            className={`inline-flex items-center gap-1.5 text-sm ${
              testResult.success ? "text-success" : "text-destructive"
            }`}
          >
            {testResult.success ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            {testResult.message}
          </p>
        )}
      </div>
    </div>
  );
}
