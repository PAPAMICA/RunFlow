"use client";

import { useEffect, useState } from "react";
import { Cpu, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, Inventory, Project } from "@/lib/api";

export default function InventoriesPage() {
  const [items, setItems] = useState<Inventory[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [content, setContent] = useState("[web]\nserver1 ansible_host=10.0.0.1");

  async function refresh() {
    const [inv, proj] = await Promise.all([api.getInventories(), api.getProjects()]);
    setItems(inv);
    setProjects(proj);
  }

  useEffect(() => { refresh().catch(console.error); }, []);

  async function handleCreate() {
    await api.createInventory({
      name,
      source_type: "internal",
      content,
      project_id: projects[0]?.id,
    });
    setName("");
    setShowCreate(false);
    await refresh();
  }

  return (
    <AppShell>
      <PageHeader
        title="Inventaires"
        description="Hôtes Ansible et groupes pour vos jobs d'infrastructure"
        action={
          <Button onClick={() => setShowCreate(!showCreate)}>
            <Plus className="h-4 w-4" />
            Nouvel inventaire
          </Button>
        }
      />

      {showCreate && (
        <Card className="mb-6 border-primary/20">
          <CardContent className="pt-5 space-y-4 max-w-xl">
            <div className="space-y-2">
              <Label>Nom</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="production" />
            </div>
            <div className="space-y-2">
              <Label>Contenu (format Ansible INI)</Label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="font-mono text-xs min-h-[160px]"
              />
            </div>
            <Button onClick={handleCreate} disabled={!name}>Créer</Button>
          </CardContent>
        </Card>
      )}

      {items.length === 0 ? (
        <EmptyState
          icon={Cpu}
          title="Aucun inventaire"
          description="Définissez vos hôtes pour les jobs Ansible."
          onAction={() => setShowCreate(true)}
          actionLabel="Créer un inventaire"
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {items.map((i) => (
            <Card key={i.id} hover>
              <CardContent className="pt-5">
                <p className="font-medium">{i.name}</p>
                <Badge variant="muted" className="mt-2">{i.source_type}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
