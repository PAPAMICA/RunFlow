"use client";

import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import {
  RunnerConfigFields,
  emptyAnsibleConfig,
  emptySshConfig,
} from "@/components/RunnerConfigFields";
import { Button } from "@/components/ui/button";
import {
  api,
  AnsibleConfig,
  Credential,
  Inventory,
  Job,
  SshConfig,
} from "@/lib/api";

export function JobRunnerConfigEditor({
  job,
  onSaved,
}: {
  job: Job;
  onSaved: (job: Job) => void;
}) {
  const [ansible, setAnsible] = useState<AnsibleConfig>(() => ({
    ...emptyAnsibleConfig(),
    ...(job.ansible_config ?? {}),
  }));
  const [ssh, setSsh] = useState<SshConfig>(() => ({
    ...emptySshConfig(),
    ...(job.ssh_config ?? {}),
  }));
  const [credentialRefs, setCredentialRefs] = useState<string[]>(job.credential_refs ?? []);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [inventories, setInventories] = useState<Inventory[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.getCredentials().then(setCredentials).catch(console.error);
    api.getInventories().then(setInventories).catch(console.error);
  }, []);

  async function save() {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const updated = await api.updateJob(job.id, {
        ansible_config: job.runner_type === "ansible" ? ansible : undefined,
        ssh_config: job.runner_type === "ssh" ? ssh : undefined,
        credential_refs: credentialRefs,
      });
      onSaved(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  if (job.runner_type !== "ansible" && job.runner_type !== "ssh") {
    return null;
  }

  return (
    <div className="space-y-4">
      <RunnerConfigFields
        runnerType={job.runner_type}
        ansible={ansible}
        onAnsible={(patch) => setAnsible((c) => ({ ...c, ...patch }))}
        ssh={ssh}
        onSsh={(patch) => setSsh((c) => ({ ...c, ...patch }))}
        credentialRefs={credentialRefs}
        onCredentialRefs={setCredentialRefs}
        credentials={credentials}
        inventories={inventories}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Enregistrer la configuration
        </Button>
        {saved && <span className="text-xs text-success">Enregistré</span>}
      </div>
    </div>
  );
}
