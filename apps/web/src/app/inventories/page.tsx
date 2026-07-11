"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Cpu, Loader2, Pencil, Plus, Radio, Trash2, XCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api, Credential, Inventory, Project } from "@/lib/api";
import { cn } from "@/lib/utils";

const DEFAULT_CONTENT = "[web]\nserver1 ansible_host=10.0.0.1";

type FormMode = "create" | "edit" | null;

export default function InventoriesPage() {
  const [items, setItems] = useState<Inventory[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [credentials, setCredentials] = useState<Credential[]>([]);

  const [mode, setMode] = useState<FormMode>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [content, setContent] = useState(DEFAULT_CONTENT);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [testCredId, setTestCredId] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; output: string } | null>(null);

  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  async function refresh() {
    const [inv, proj, creds] = await Promise.all([
      api.getInventories(),
      api.getProjects(),
      api.getCredentials().catch(() => []),
    ]);
    setItems(inv);
    setProjects(proj);
    setCredentials(creds);
  }

  useEffect(() => {
    refresh().catch(console.error);
  }, []);

  function openCreate() {
    setMode("create");
    setEditingId(null);
    setName("");
    setContent(DEFAULT_CONTENT);
    setError("");
    setTestResult(null);
  }

  async function openEdit(id: string) {
    setError("");
    setTestResult(null);
    try {
      const detail = await api.getInventory(id);
      setMode("edit");
      setEditingId(id);
      setName(detail.name);
      setContent(detail.content ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  }

  function closeForm() {
    setMode(null);
    setEditingId(null);
    setTestResult(null);
  }

  async function handleSave() {
    setError("");
    setSaving(true);
    try {
      if (mode === "edit" && editingId) {
        await api.updateInventory(editingId, { name, content });
      } else {
        await api.createInventory({
          name,
          source_type: "internal",
          content,
          project_id: projects[0]?.id,
        });
      }
      closeForm();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setError("");
    try {
      await api.deleteInventory(id);
      setConfirmDelete(null);
      if (editingId === id) closeForm();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  }

  async function runTest() {
    if (!editingId) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.testInventory(editingId, {
        credential_id: testCredId || undefined,
        content,
      });
      setTestResult(res);
    } catch (err) {
      setTestResult({ success: false, output: err instanceof Error ? err.message : "Erreur" });
    } finally {
      setTesting(false);
    }
  }

  const sshCreds = credentials.filter((c) => ["ssh", "basic"].includes(c.credential_type));

  return (
    <AppShell>
      <PageHeader
        title="Inventaires"
        description="Hôtes Ansible et groupes pour vos jobs d'infrastructure"
        action={
          <Button onClick={() => (mode ? closeForm() : openCreate())}>
            <Plus className="h-4 w-4" />
            Nouvel inventaire
          </Button>
        }
      />

      {error && !mode && (
        <p className="mb-4 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
      )}

      {mode && (
        <Card className="mb-6 border-primary/20">
          <CardContent className="pt-5 space-y-4 max-w-2xl">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">
                {mode === "edit" ? "Modifier l'inventaire" : "Nouvel inventaire"}
              </h3>
            </div>
            <div className="space-y-2">
              <Label>Nom</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="production" />
            </div>
            <div className="space-y-2">
              <Label>Contenu (format Ansible INI)</Label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="font-mono text-xs min-h-[180px]"
                spellCheck={false}
              />
            </div>

            {/* Test section */}
            <div className="rounded-lg border border-border bg-surface-2/40 p-3 space-y-3">
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Tester la connectivité (ansible ping)</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <div className="space-y-1.5">
                  <Label className="text-xs">Credential SSH</Label>
                  <Select value={testCredId} onChange={(e) => setTestCredId(e.target.value)}>
                    <option value="">Aucun (config SSH par défaut)</option>
                    {sshCreds.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.credential_type})
                      </option>
                    ))}
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={runTest}
                  disabled={testing || !editingId}
                  title={!editingId ? "Enregistrez d'abord l'inventaire" : undefined}
                >
                  {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radio className="h-4 w-4" />}
                  {testing ? "Test en cours…" : "Lancer le ping"}
                </Button>
              </div>
              {!editingId && (
                <p className="text-[11px] text-muted-foreground">
                  Enregistrez l&apos;inventaire pour pouvoir le tester.
                </p>
              )}
              {sshCreds.length === 0 && (
                <p className="text-[11px] text-muted-foreground">
                  Aucun credential SSH — créez-en un dans la page Credentials.
                </p>
              )}
              {testResult && (
                <div
                  className={cn(
                    "rounded-lg border p-3 space-y-1.5",
                    testResult.success
                      ? "border-success/30 bg-success/5"
                      : "border-destructive/30 bg-destructive/5"
                  )}
                >
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {testResult.success ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                    {testResult.success ? "Ping réussi" : "Ping échoué"}
                  </div>
                  <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded bg-black/40 p-2 font-mono text-[11px] text-foreground/90">
                    {testResult.output}
                  </pre>
                </div>
              )}
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex items-center gap-2">
              <Button onClick={handleSave} disabled={!name.trim() || saving}>
                {saving ? "Enregistrement…" : mode === "edit" ? "Enregistrer" : "Créer"}
              </Button>
              <Button variant="outline" onClick={closeForm}>
                Annuler
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {items.length === 0 && !mode ? (
        <EmptyState
          icon={Cpu}
          title="Aucun inventaire"
          description="Définissez vos hôtes pour les jobs Ansible et SSH."
          onAction={openCreate}
          actionLabel="Créer un inventaire"
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {items.map((i) => (
            <Card key={i.id}>
              <CardContent className="pt-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 text-primary">
                      <Cpu className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{i.name}</p>
                      <Badge variant="muted" className="mt-1">{i.source_type}</Badge>
                    </div>
                  </div>
                  {confirmDelete === i.id ? (
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(i.id)}>
                        Oui
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setConfirmDelete(null)}>
                        Non
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => openEdit(i.id)}
                        title="Modifier"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => setConfirmDelete(i.id)}
                        title="Supprimer"
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
