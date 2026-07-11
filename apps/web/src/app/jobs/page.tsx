"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Boxes, GitBranch, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DataTable, DataTableSkeleton } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { FavoriteButton } from "@/components/FavoriteButton";
import { JobDeployForm } from "@/components/JobDeployForm";
import { PageHeader } from "@/components/PageHeader";
import { SearchInput } from "@/components/SearchInput";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api, Job, Project } from "@/lib/api";

export default function JobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showDeploy, setShowDeploy] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getJobs(), api.getProjects()])
      .then(([j, p]) => {
        setJobs(j);
        setProjects(p);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter(
      (j) =>
        j.name.toLowerCase().includes(q) ||
        j.slug.toLowerCase().includes(q) ||
        j.entrypoint.toLowerCase().includes(q)
    );
  }, [jobs, search]);

  return (
    <AppShell>
      <PageHeader
        title="Jobs"
        description="Scripts Python, Bash ou Ansible — internes ou depuis Git"
        action={
          <Button onClick={() => setShowDeploy(!showDeploy)} size="lg">
            <Plus className="h-4 w-4" />
            Déployer un job
          </Button>
        }
      />

      {showDeploy && projects.length > 0 && (
        <JobDeployForm
          projects={projects}
          onCreated={(id) => router.push(`/jobs/${id}`)}
          onCancel={() => setShowDeploy(false)}
        />
      )}

      {!loading && jobs.length > 0 && (
        <div className="mb-4 max-w-sm">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Filtrer par nom, slug ou entrypoint…"
          />
        </div>
      )}

      {loading ? (
        <Card>
          <CardContent className="pt-5">
            <DataTableSkeleton />
          </CardContent>
        </Card>
      ) : jobs.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="Aucun job"
          description="Déployez un job Git avec script Python, arguments et fichier .env."
          onAction={() => setShowDeploy(true)}
          actionLabel="Déployer un job"
        />
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Aucun job ne correspond à « {search} »
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-5">
            <DataTable>
              <thead>
                <tr>
                  <th className="w-10" />
                  <th>Nom</th>
                  <th>Source</th>
                  <th>Runner</th>
                  <th>Entrypoint</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((j) => (
                  <tr key={j.id}>
                    <td>
                      <FavoriteButton jobId={j.id} />
                    </td>
                    <td>
                      <Link href={`/jobs/${j.id}`} className="link-primary">
                        {j.name}
                      </Link>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">{j.slug}</p>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant={j.source_type === "git" ? "default" : "muted"}>
                          {j.source_type === "git" ? (
                            <span className="flex items-center gap-1">
                              <GitBranch className="h-3 w-3" /> Git
                            </span>
                          ) : (
                            "internal"
                          )}
                        </Badge>
                        {j.has_env_file && <Badge variant="accent">.env</Badge>}
                      </div>
                    </td>
                    <td>
                      <span className="font-mono text-xs bg-background/80 px-2 py-1 rounded-md border border-border">
                        {j.runner_type}
                      </span>
                    </td>
                    <td className="font-mono text-xs text-muted-foreground max-w-[200px] truncate">
                      {j.entrypoint}
                    </td>
                    <td>
                      <StatusBadge status={j.enabled ? "enabled" : "disabled"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </CardContent>
        </Card>
      )}
    </AppShell>
  );
}
