"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Boxes,
  ChevronUp,
  GitBranch,
  Loader2,
  Play,
  Settings2,
  Star,
  Trash2,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import {
  getFavoriteArguments,
  getFavorites,
  removeFavorite,
  updateFavoriteArguments,
} from "@/lib/favorites";
import {
  buildRunArguments,
  canLaunchDirectly,
  defaultArgsFromJob,
  getUserFacingParameters,
} from "@/lib/job-args";
import { api, Job } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export default function FavoritesPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [error, setError] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editArgs, setEditArgs] = useState<Record<string, Record<string, string>>>({});

  function reloadFavorites() {
    setFavoriteIds(getFavorites().map((f) => f.jobId));
  }

  useEffect(() => {
    api.getJobs()
      .then(setJobs)
      .catch(console.error)
      .finally(() => setLoading(false));
    reloadFavorites();
  }, []);

  const favoriteJobs = useMemo(() => {
    const byId = new Map(jobs.map((j) => [j.id, j]));
    return favoriteIds
      .map((id) => byId.get(id))
      .filter((j): j is Job => Boolean(j));
  }, [jobs, favoriteIds]);

  const missingCount = favoriteIds.length - favoriteJobs.length;

  function getArgsForJob(job: Job): Record<string, string> {
    if (editArgs[job.id]) return editArgs[job.id];
    const saved = getFavoriteArguments(job.id);
    if (saved) return saved;
    return defaultArgsFromJob(job);
  }

  function setJobArgs(jobId: string, args: Record<string, string>) {
    setEditArgs((prev) => ({ ...prev, [jobId]: args }));
  }

  async function launchJob(job: Job) {
    setRunningId(job.id);
    setError((prev) => ({ ...prev, [job.id]: "" }));
    const rawArgs = getArgsForJob(job);
    updateFavoriteArguments(job.id, rawArgs);
    try {
      const args = buildRunArguments(job, rawArgs);
      const queued = (await api.runJob(job.slug, args, false)) as {
        run_id: string;
        status: string;
      };
      router.push(`/runs/${queued.run_id}`);
    } catch (err) {
      setError((prev) => ({
        ...prev,
        [job.id]: err instanceof Error ? err.message : "Erreur de lancement",
      }));
      setRunningId(null);
    }
  }

  function handleRemove(jobId: string) {
    removeFavorite(jobId);
    reloadFavorites();
  }

  return (
    <AppShell>
      <PageHeader
        title="Favoris"
        description="Lancez vos jobs les plus utilisés en un clic"
        action={
          <Link href="/jobs">
            <Button variant="outline">
              <Boxes className="h-4 w-4" />
              Tous les jobs
            </Button>
          </Link>
        }
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 rounded-xl border border-border bg-card/40 animate-pulse" />
          ))}
        </div>
      ) : favoriteJobs.length === 0 ? (
        <EmptyState
          icon={Star}
          title="Aucun favori"
          description="Ajoutez des jobs à vos favoris depuis la liste des jobs ou la page détail — icône étoile."
          onAction={() => router.push("/jobs")}
          actionLabel="Parcourir les jobs"
        />
      ) : (
        <>
          {missingCount > 0 && (
            <p className="text-sm text-muted-foreground mb-4">
              {missingCount} favori(s) introuvable(s) (job supprimé) — nettoyés automatiquement au prochain retrait.
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {favoriteJobs.map((job) => {
              const isRunning = runningId === job.id;
              const expanded = expandedId === job.id;
              const args = getArgsForJob(job);
              const directLaunch = canLaunchDirectly(job);
              const userParams = getUserFacingParameters(job);
              const forcedEntries = Object.entries(job.forced_arguments ?? {});

              return (
                <Card
                  key={job.id}
                  className={cn(
                    "overflow-hidden transition-all",
                    "hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5",
                    isRunning && "border-primary/40"
                  )}
                >
                  <CardContent className="pt-5 space-y-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Star className="h-4 w-4 fill-warning text-warning shrink-0" />
                          <Link href={`/jobs/${job.id}`} className="font-semibold truncate hover:text-primary">
                            {job.name}
                          </Link>
                        </div>
                        <p className="text-xs font-mono text-muted-foreground mt-1 truncate">{job.slug}</p>
                      </div>
                      <StatusBadge status={job.enabled ? "enabled" : "disabled"} />
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="muted" className="text-[10px]">{job.runner_type}</Badge>
                      {job.source_type === "git" && (
                        <Badge variant="default" className="text-[10px] gap-1">
                          <GitBranch className="h-3 w-3" /> Git
                        </Badge>
                      )}
                      {forcedEntries.length > 0 && (
                        <Badge variant="warning" className="text-[10px]">
                          {forcedEntries.length} forcé{forcedEntries.length > 1 ? "s" : ""}
                        </Badge>
                      )}
                      {userParams.length > 0 && (
                        <Badge variant="accent" className="text-[10px]">
                          {userParams.length} param{userParams.length > 1 ? "s" : ""}
                        </Badge>
                      )}
                    </div>

                    {error[job.id] && (
                      <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                        {error[job.id]}
                      </p>
                    )}

                    <div className="flex gap-2">
                      <Button
                        className="flex-1"
                        size="lg"
                        disabled={!job.enabled || isRunning}
                        onClick={() => launchJob(job)}
                      >
                        {isRunning ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Lancement…
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4" />
                            Lancer
                          </>
                        )}
                      </Button>
                      {userParams.length > 0 && (
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setExpandedId(expanded ? null : job.id)}
                          title="Configurer les arguments"
                        >
                          {expanded ? <ChevronUp className="h-4 w-4" /> : <Settings2 className="h-4 w-4" />}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleRemove(job.id)}
                        title="Retirer des favoris"
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>

                    {expanded && userParams.length > 0 && (
                      <div className="space-y-3 pt-2 border-t border-border-subtle">
                        {userParams.map((p) => (
                          <div key={p.id} className="space-y-1">
                            <Label className="text-xs font-mono">{p.name}</Label>
                            {p.param_type === "flag" ? (
                              <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={(args[p.name] ?? "false") === "true"}
                                  onChange={(e) =>
                                    setJobArgs(job.id, {
                                      ...args,
                                      [p.name]: e.target.checked ? "true" : "false",
                                    })
                                  }
                                  className="h-4 w-4 accent-[var(--primary)]"
                                />
                                <span className="text-muted-foreground font-mono">
                                  --{p.name.replace(/_/g, "-")}
                                </span>
                              </label>
                            ) : p.param_type === "boolean" ? (
                              <Select
                                value={args[p.name] ?? "false"}
                                onChange={(e) =>
                                  setJobArgs(job.id, { ...args, [p.name]: e.target.value })
                                }
                              >
                                <option value="true">true</option>
                                <option value="false">false</option>
                              </Select>
                            ) : (
                              <Input
                                value={args[p.name] ?? ""}
                                onChange={(e) =>
                                  setJobArgs(job.id, { ...args, [p.name]: e.target.value })
                                }
                                className="font-mono text-xs h-8"
                              />
                            )}
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => {
                            updateFavoriteArguments(job.id, args);
                            setExpandedId(null);
                          }}
                        >
                          Enregistrer les arguments
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </AppShell>
  );
}
