"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Boxes, GitBranch, HardDrive, Plus, SlidersHorizontal } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DataTable, DataTableSkeleton } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { FavoriteButton } from "@/components/FavoriteButton";
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

  const projectName = useMemo(() => {
    const map = new Map(projects.map((p) => [p.id, p.name]));
    return (id: string) => map.get(id) ?? "—";
  }, [projects]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter(
      (j) =>
        j.name.toLowerCase().includes(q) ||
        j.slug.toLowerCase().includes(q) ||
        j.entrypoint.toLowerCase().includes(q) ||
        projectName(j.project_id).toLowerCase().includes(q)
    );
  }, [jobs, search, projectName]);

  return (
    <AppShell>
      <PageHeader
        title="Jobs"
        description="Scripts Python, Bash ou Ansible — internes ou depuis Git"
        action={
          <Button onClick={() => router.push("/jobs/new")} size="lg">
            <Plus className="h-4 w-4" />
            Nouveau job
          </Button>
        }
      />

      {!loading && jobs.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="max-w-sm flex-1 min-w-[220px]">
            <SearchInput value={search} onChange={setSearch} placeholder="Filtrer par nom, slug, projet…" />
          </div>
          <p className="text-sm text-muted-foreground">
            {filtered.length === jobs.length
              ? `${jobs.length} job${jobs.length > 1 ? "s" : ""}`
              : `${filtered.length} / ${jobs.length}`}
          </p>
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
          onAction={() => router.push("/jobs/new")}
          actionLabel="Nouveau job"
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
                  <th>Projet</th>
                  <th>Source</th>
                  <th>Runner</th>
                  <th>Entrypoint</th>
                  <th>Args</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((j) => (
                  <tr
                    key={j.id}
                    onClick={() => router.push(`/jobs/${j.id}`)}
                    className="cursor-pointer"
                  >
                    <td onClick={(e) => e.stopPropagation()}>
                      <FavoriteButton jobId={j.id} />
                    </td>
                    <td>
                      <Link href={`/jobs/${j.id}`} className="link-primary" onClick={(e) => e.stopPropagation()}>
                        {j.name}
                      </Link>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">{j.slug}</p>
                    </td>
                    <td className="text-sm text-muted-foreground">{projectName(j.project_id)}</td>
                    <td>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant={j.source_type === "git" ? "default" : "muted"}>
                          <span className="flex items-center gap-1">
                            {j.source_type === "git" ? (
                              <>
                                <GitBranch className="h-3 w-3" /> Git
                              </>
                            ) : (
                              <>
                                <HardDrive className="h-3 w-3" /> Interne
                              </>
                            )}
                          </span>
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
                    <td className="text-muted-foreground text-xs">
                      {j.parameters.length > 0 ? (
                        <span className="inline-flex items-center gap-1">
                          <SlidersHorizontal className="h-3 w-3" />
                          {j.parameters.length}
                        </span>
                      ) : (
                        "—"
                      )}
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
