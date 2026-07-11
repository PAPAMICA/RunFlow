"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { api, Job, Project } from "@/lib/api";

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  useEffect(() => {
    api.getJobs().then(setJobs).catch(console.error);
    api.getProjects().then(setProjects).catch(console.error);
  }, []);

  async function createJob() {
    if (!projects[0]) return;
    const job = await api.createJob({
      project_id: projects[0].id,
      name,
      slug,
      runner_type: "python",
      entrypoint: "main.py",
    });
    setJobs((prev) => [...prev, job]);
    setShowCreate(false);
    setName("");
    setSlug("");
  }

  return (
    <AppShell>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Jobs</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-primary text-white rounded text-sm"
        >
          Nouveau Job
        </button>
      </div>

      {showCreate && (
        <div className="mb-6 p-4 bg-card border border-border rounded flex gap-4 items-end">
          <label>
            <span className="text-sm text-muted">Nom</span>
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"));
              }}
              className="block mt-1 px-3 py-2 bg-background border border-border rounded"
            />
          </label>
          <label>
            <span className="text-sm text-muted">Slug</span>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="block mt-1 px-3 py-2 bg-background border border-border rounded"
            />
          </label>
          <button onClick={createJob} className="px-4 py-2 bg-primary text-white rounded text-sm">
            Créer
          </button>
        </div>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted border-b border-border">
            <th className="pb-2">Nom</th>
            <th className="pb-2">Runner</th>
            <th className="pb-2">Source</th>
            <th className="pb-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((j) => (
            <tr key={j.id} className="border-b border-border/50">
              <td className="py-2">
                <Link href={`/jobs/${j.id}`} className="text-primary hover:underline">
                  {j.name}
                </Link>
              </td>
              <td className="py-2">{j.runner_type}</td>
              <td className="py-2">{j.source_type}</td>
              <td className="py-2">{j.enabled ? "enabled" : "disabled"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </AppShell>
  );
}
