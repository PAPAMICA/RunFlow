"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Boxes } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { JobDeployForm } from "@/components/JobDeployForm";
import { PageHeader } from "@/components/PageHeader";
import { api, Project } from "@/lib/api";

export default function NewJobPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[] | null>(null);

  useEffect(() => {
    api.getProjects().then(setProjects).catch(() => setProjects([]));
  }, []);

  return (
    <AppShell>
      <PageHeader
        title="Nouveau job"
        description="Source, entrypoint, environnement et arguments — le tout en une page"
        breadcrumb={[{ label: "Jobs", href: "/jobs" }, { label: "Nouveau" }]}
      />

      {projects === null ? (
        <div className="h-72 rounded-2xl bg-card animate-pulse" />
      ) : projects.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="Aucun projet"
          description="Créez d'abord un projet pour pouvoir y déployer des jobs."
          onAction={() => router.push("/jobs")}
          actionLabel="Retour aux jobs"
        />
      ) : (
        <JobDeployForm
          projects={projects}
          onCreated={(id) => router.push(`/jobs/${id}`)}
          onCancel={() => router.push("/jobs")}
        />
      )}
    </AppShell>
  );
}
