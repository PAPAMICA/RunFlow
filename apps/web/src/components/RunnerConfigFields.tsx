"use client";

import { AnsibleConfig, Credential, Inventory, SshConfig } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

function csvToList(value: string): string[] {
  return value
    .split(/[,\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function CheckboxList({
  items,
  selected,
  onToggle,
  empty,
}: {
  items: { id: string; label: string }[];
  selected: string[];
  onToggle: (id: string) => void;
  empty: string;
}) {
  if (items.length === 0) {
    return <p className="text-xs text-muted-foreground">{empty}</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it) => {
        const active = selected.includes(it.id);
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => onToggle(it.id)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm transition-all",
              active
                ? "border-primary/50 bg-primary/10 text-foreground"
                : "border-border text-muted-foreground hover:bg-card-hover"
            )}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

export function RunnerConfigFields({
  runnerType,
  ansible,
  onAnsible,
  ssh,
  onSsh,
  credentialRefs,
  onCredentialRefs,
  credentials,
  inventories,
}: {
  runnerType: string;
  ansible: AnsibleConfig;
  onAnsible: (patch: Partial<AnsibleConfig>) => void;
  ssh: SshConfig;
  onSsh: (patch: Partial<SshConfig>) => void;
  credentialRefs: string[];
  onCredentialRefs: (refs: string[]) => void;
  credentials: Credential[];
  inventories: Inventory[];
}) {
  function toggle(list: string[], id: string): string[] {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  }

  const credItems = credentials.map((c) => ({ id: c.id, label: `${c.name} (${c.credential_type})` }));
  const invItems = inventories.map((i) => ({ id: i.id, label: i.name }));

  if (runnerType === "ansible") {
    const invSource = ansible.inventory_source ?? "internal";
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Playbook</Label>
          <Input
            value={ansible.playbook ?? ""}
            onChange={(e) => onAnsible({ playbook: e.target.value })}
            placeholder="playbook.yml"
            className="font-mono text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label>Source de l&apos;inventaire</Label>
          <div className="flex gap-2">
            {(["internal", "refs"] as const).map((src) => (
              <button
                key={src}
                type="button"
                onClick={() => onAnsible({ inventory_source: src })}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-sm transition-all",
                  invSource === src
                    ? "border-primary/50 bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:bg-card-hover"
                )}
              >
                {src === "internal" ? "Contenu interne" : "Inventaires enregistrés"}
              </button>
            ))}
          </div>
        </div>

        {invSource === "internal" ? (
          <div className="space-y-2">
            <Label>Contenu de l&apos;inventaire (INI)</Label>
            <Textarea
              value={ansible.inventory_content ?? ""}
              onChange={(e) => onAnsible({ inventory_content: e.target.value })}
              placeholder={"[web]\nserver1.example.com\nserver2.example.com ansible_host=10.0.0.2"}
              className="font-mono text-xs min-h-[100px]"
            />
          </div>
        ) : (
          <div className="space-y-2">
            <Label>Inventaires</Label>
            <CheckboxList
              items={invItems}
              selected={ansible.inventory_refs ?? []}
              onToggle={(id) => onAnsible({ inventory_refs: toggle(ansible.inventory_refs ?? [], id) })}
              empty="Aucun inventaire enregistré."
            />
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Tags (séparés par des virgules)</Label>
            <Input
              value={(ansible.tags ?? []).join(", ")}
              onChange={(e) => onAnsible({ tags: csvToList(e.target.value) })}
              placeholder="deploy, config"
            />
          </div>
          <div className="space-y-2">
            <Label>Skip tags</Label>
            <Input
              value={(ansible.skip_tags ?? []).join(", ")}
              onChange={(e) => onAnsible({ skip_tags: csvToList(e.target.value) })}
              placeholder="slow"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Limit (hôtes/groupes)</Label>
          <Input
            value={ansible.limit ?? ""}
            onChange={(e) => onAnsible({ limit: e.target.value })}
            placeholder="web"
          />
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={Boolean(ansible.become)}
            onChange={(e) => onAnsible({ become: e.target.checked })}
            className="h-4 w-4 accent-[var(--primary)]"
          />
          Élévation de privilèges (--become)
        </label>

        <div className="space-y-2">
          <Label>Credentials (clé SSH / user+mot de passe)</Label>
          <CheckboxList
            items={credItems}
            selected={credentialRefs}
            onToggle={(id) => onCredentialRefs(toggle(credentialRefs, id))}
            empty="Aucun credential. Créez-en un dans la page Credentials."
          />
        </div>
      </div>
    );
  }

  if (runnerType === "ssh") {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Hôtes (un par ligne ou séparés par des virgules)</Label>
          <Textarea
            value={(ssh.hosts ?? []).join("\n")}
            onChange={(e) => onSsh({ hosts: csvToList(e.target.value) })}
            placeholder={"server1.example.com\n10.0.0.5"}
            className="font-mono text-xs min-h-[70px]"
          />
        </div>

        <div className="space-y-2">
          <Label>Inventaires (source d&apos;hôtes additionnelle)</Label>
          <CheckboxList
            items={invItems}
            selected={ssh.inventory_refs ?? []}
            onToggle={(id) => onSsh({ inventory_refs: toggle(ssh.inventory_refs ?? [], id) })}
            empty="Aucun inventaire enregistré."
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Utilisateur</Label>
            <Input value={ssh.user ?? ""} onChange={(e) => onSsh({ user: e.target.value })} placeholder="root" />
          </div>
          <div className="space-y-2">
            <Label>Port</Label>
            <Input
              type="number"
              value={String(ssh.port ?? 22)}
              onChange={(e) => onSsh({ port: Number(e.target.value) || 22 })}
            />
          </div>
          <div className="space-y-2">
            <Label>Argument &laquo; hôtes &raquo;</Label>
            <Input
              value={ssh.hosts_argument ?? ""}
              onChange={(e) => onSsh({ hosts_argument: e.target.value || null })}
              placeholder="hosts"
              className="font-mono text-xs"
            />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground -mt-2">
          Les hôtes de la config, des inventaires et de l&apos;argument nommé sont fusionnés.
        </p>

        <div className="space-y-2">
          <Label>Commande / script distant</Label>
          <Textarea
            value={ssh.command ?? ""}
            onChange={(e) => onSsh({ command: e.target.value })}
            placeholder={"#!/usr/bin/env bash\nuptime\ndf -h /"}
            className="font-mono text-xs min-h-[100px]"
          />
          <p className="text-[11px] text-muted-foreground">
            Exécuté via <code>bash -s</code> sur chaque hôte. Placeholders <code>{"{{ arg }}"}</code> remplacés (échappés) par les arguments du run.
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={Boolean(ssh.become)}
            onChange={(e) => onSsh({ become: e.target.checked })}
            className="h-4 w-4 accent-[var(--primary)]"
          />
          Exécuter avec sudo (become)
        </label>

        <div className="space-y-2">
          <Label>Credentials (clé SSH ou user + mot de passe)</Label>
          <CheckboxList
            items={credItems}
            selected={credentialRefs}
            onToggle={(id) => onCredentialRefs(toggle(credentialRefs, id))}
            empty="Aucun credential. Créez-en un dans la page Credentials."
          />
        </div>
      </div>
    );
  }

  return null;
}

export const emptyAnsibleConfig = (): AnsibleConfig => ({
  playbook: "playbook.yml",
  inventory_source: "internal",
  inventory_content: "",
  inventory_refs: [],
  tags: [],
  skip_tags: [],
  limit: "",
  become: false,
  extra_vars: {},
});

export const emptySshConfig = (): SshConfig => ({
  hosts: [],
  inventory_refs: [],
  hosts_argument: null,
  user: "root",
  port: 22,
  command: "",
  become: false,
});
