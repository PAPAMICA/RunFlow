"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Boxes, GitBranch, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { JobDeployForm } from "@/components/JobDeployForm";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api, Job, Project } from "@/lib/api";

export default function JobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showDeploy, setShowDeploy] = useState(false);
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

  return (
    <AppShell>
      <PageHeader
        title="Jobs"
        description="Scripts Python, Bash ou Ansible — internes ou depuis Git"
        action={
          <Button onClick={() => setShowDeploy(!showDeploy)}>
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

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="Aucun job"
          description="Déployez un job Git avec script Python, arguments et fichier .env."
          onAction={() => setShowDeploy(true)}
          actionLabel="Déployer un job"
        />
      ) : (
        <Card>
          <CardContent className="pt-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="pb-3 font-medium">Nom</th>
                  <th className="pb-3 font-medium">Source</th>
                  <th className="pb-3 font-medium">Runner</th>
                  <th className="pb-3 font-medium">Entrypoint</th>
                  <th className="pb-3 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id} className="border-b border-border-subtle hover:bg-card-hover/50 transition-colors">
                    <td className="py-3">
                      <Link href={`/jobs/${j.id}`} className="font-medium text-primary hover:underline">
                        {j.name}
                      </Link>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">{j.slug}</p>
                    </td>
                    <td className="py-3">
                      <Badge variant={j.source_type === "git" ? "default" : "muted"}>
                        {j.source_type === "git" ? (
                          <span className="flex items-center gap-1"><GitBranch className="h-3 w-3" /> Git</span>
                        ) : (
                          "internal"
                        )}
                      </Badge>
                      {j.has_env_file && (
                        <Badge variant="accent" className="ml-2">.env</Badge>
                      )}
                    </td>
                    <td className="py-3">
                      <span className="font-mono text-xs bg-card px-2 py-1 rounded border border-border">
                        {j.runner_type}
                      </span>
                    </td>
                    <td className="py-3 font-mono text-xs text-muted-foreground">{j.entrypoint}</td>
                    <td className="py-3">
                      <StatusBadge status={j.enabled ? "enabled" : "disabled"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </AppShell>
  );
}
