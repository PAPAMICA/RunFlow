"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { getApiBase, getHookUrl } from "@/lib/trigger-types";
import { Job, Trigger } from "@/lib/api";

function CopyBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative group">
      <pre className="text-[11px] leading-relaxed font-mono bg-black/40 rounded-lg p-3 pr-10 overflow-x-auto whitespace-pre">
        {code}
      </pre>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="absolute top-2 right-2 rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-card-hover transition-colors"
        aria-label="Copier"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

interface Step {
  title: string;
  description?: string;
  code?: string;
}

function buildSteps(trigger: Trigger, jobs: Job[]): Step[] {
  const config = (trigger.config ?? {}) as Record<string, unknown>;
  const apiBase = getApiBase();
  const hookUrl = trigger.hook_token ? getHookUrl(trigger.hook_token) : "";
  const targetJob = jobs.find((j) => j.id === trigger.target_id);
  const runCurl = (slug: string, args = "{}") =>
    [
      `curl -X POST '${apiBase}/api/v1/jobs/${slug}/run' \\`,
      `  -H 'Authorization: Bearer <API_KEY>' \\`,
      `  -H 'Content-Type: application/json' \\`,
      `  -d '{"arguments": ${args}}'`,
    ].join("\n");

  switch (trigger.trigger_type) {
    case "webhook": {
      const authType = (config.auth_type as string) ?? "none";
      const authConfig = (config.auth_config ?? {}) as Record<string, string>;
      const body = `{"env": "prod", "ref": "main"}`;

      if (authType === "hmac_sha256") {
        const header = authConfig.header || "X-Signature-256";
        const secret = authConfig.secret || "<secret>";
        return [
          {
            title: "1. Envoyer une requête signée (HMAC SHA-256)",
            description:
              "La signature est calculée sur le corps exact envoyé. Exécutez ce script (openssl requis) :",
            code: [
              `SECRET='${secret}'`,
              `BODY='${body}'`,
              `SIG="sha256=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | sed 's/^.* //')"`,
              `curl -X POST '${hookUrl}' \\`,
              `  -H 'Content-Type: application/json' \\`,
              `  -H "${header}: $SIG" \\`,
              `  -d "$BODY"`,
            ].join("\n"),
          },
          {
            title: "2. Utiliser le corps dans le job",
            description:
              "Les champs JSON sont accessibles via webhook.body.* dans le mapping d'arguments (ex. {{ webhook.body.env }}).",
          },
        ];
      }

      let authLine = "";
      if (authType === "bearer") {
        authLine = `  -H 'Authorization: Bearer ${authConfig.token || "<token>"}' \\\n`;
      } else if (authType === "secret_header") {
        authLine = `  -H '${authConfig.header || "X-Webhook-Secret"}: ${authConfig.secret || "<secret>"}' \\\n`;
      }

      return [
        {
          title: "1. Déclencher le webhook",
          description:
            authType === "none"
              ? "Envoyez une requête POST avec un corps JSON (aucune authentification requise) :"
              : "Envoyez une requête POST avec l'en-tête d'authentification configuré :",
          code: `curl -X POST '${hookUrl}' \\\n  -H 'Content-Type: application/json' \\\n${authLine}  -d '${body}'`,
        },
        {
          title: "2. Réponse attendue",
          description: "Un statut 200 avec le run créé confirme le déclenchement.",
          code: `{"run_id": "01...", "status": "queued"}`,
        },
        {
          title: "3. Utiliser le corps dans le job",
          description:
            "Les champs JSON sont accessibles via webhook.body.* dans le mapping d'arguments (ex. {{ webhook.body.env }}).",
        },
      ];
    }

    case "git_push": {
      const provider = ((config.provider as string) || "github").toLowerCase();
      const secret = (config.secret as string) || "";
      const branches = (config.branches as string[]) || [];
      const branch = branches[0] || "main";

      const register: Step = {
        title: "1. Enregistrer le webhook dans le dépôt",
        description:
          provider === "github"
            ? "GitHub → Settings → Webhooks → Add webhook. Payload URL ci-dessous, Content type = application/json, Secret identique, événement « Just the push event »."
            : provider === "gitlab"
              ? "GitLab → Settings → Webhooks. URL ci-dessous, Secret token identique, cochez « Push events »."
              : "Ajoutez un webhook POST vers l'URL ci-dessous dans votre fournisseur Git.",
        code: hookUrl,
      };

      let simulate: Step;
      if (provider === "github") {
        const bodyGh = `{"ref":"refs/heads/${branch}","after":"abc123","repository":{"full_name":"owner/repo"},"pusher":{"name":"tester"},"commits":[{}]}`;
        simulate = {
          title: "2. Simuler un push (ou utiliser « Recent Deliveries → Redeliver »)",
          code: secret
            ? [
                `SECRET='${secret}'`,
                `BODY='${bodyGh}'`,
                `SIG="sha256=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | sed 's/^.* //')"`,
                `curl -X POST '${hookUrl}' \\`,
                `  -H 'Content-Type: application/json' \\`,
                `  -H 'X-GitHub-Event: push' \\`,
                `  -H "X-Hub-Signature-256: $SIG" \\`,
                `  -d "$BODY"`,
              ].join("\n")
            : [
                `curl -X POST '${hookUrl}' \\`,
                `  -H 'Content-Type: application/json' \\`,
                `  -H 'X-GitHub-Event: push' \\`,
                `  -d '${bodyGh}'`,
              ].join("\n"),
        };
      } else if (provider === "gitlab") {
        const bodyGl = `{"ref":"refs/heads/${branch}","project":{"path_with_namespace":"owner/repo"},"user_username":"tester","checkout_sha":"abc123"}`;
        simulate = {
          title: "2. Simuler un push (ou « Test → Push events » dans GitLab)",
          code: [
            `curl -X POST '${hookUrl}' \\`,
            `  -H 'Content-Type: application/json' \\`,
            `  -H 'X-Gitlab-Event: Push Hook' \\`,
            secret ? `  -H 'X-Gitlab-Token: ${secret}' \\` : "",
            `  -d '${bodyGl}'`,
          ]
            .filter(Boolean)
            .join("\n"),
        };
      } else {
        const bodyGen = `{"ref":"refs/heads/${branch}","branch":"${branch}","repository":"owner/repo"}`;
        simulate = {
          title: "2. Simuler un push",
          code: [
            `curl -X POST '${hookUrl}' \\`,
            `  -H 'Content-Type: application/json' \\`,
            secret ? `  -H 'X-Runflow-Secret: ${secret}' \\` : "",
            `  -d '${bodyGen}'`,
          ]
            .filter(Boolean)
            .join("\n"),
        };
      }

      return [
        register,
        simulate,
        {
          title: "3. Filtre de branche",
          description: branches.length
            ? `Seuls les push sur : ${branches.join(", ")} déclenchent le job.`
            : "Toutes les branches déclenchent le job (aucun filtre configuré).",
        },
      ];
    }

    case "schedule": {
      const cron = (config.cron as string) || cronFromSimple(config);
      const tz = (config.timezone as string) || "Europe/Paris";
      const steps: Step[] = [
        {
          title: "1. Déclenchement automatique",
          description: `Le job s'exécute selon la planification « ${cron} » (${tz}). Aucune action externe n'est nécessaire.`,
        },
      ];
      if (targetJob) {
        steps.push({
          title: "2. Vérifier immédiatement",
          description: "Lancez le job manuellement pour valider son exécution :",
          code: runCurl(targetJob.slug),
        });
      }
      steps.push({
        title: `${targetJob ? "3" : "2"}. Astuce`,
        description:
          "Réglez temporairement le cron sur */1 * * * * (chaque minute) pour observer un déclenchement, puis remettez la valeur voulue.",
      });
      return steps;
    }

    case "email": {
      const conditions = ((config.conditions as Record<string, unknown>)?.conditions ?? []) as {
        field: string;
        value: string;
      }[];
      const desc = conditions.length
        ? conditions.map((c) => `${c.field} contient « ${c.value} »`).join(" et ")
        : "aucune condition (tout email déclenche le job)";
      return [
        {
          title: "1. Envoyer un email de test",
          description: `Envoyez un email à la boîte surveillée respectant : ${desc}.`,
        },
        {
          title: "2. Attendre le prochain relevé IMAP",
          description:
            "Le poller vérifie la boîte périodiquement ; le job démarre dès qu'un email correspondant est trouvé. Champs disponibles : email.subject, email.from, email.body.",
        },
      ];
    }

    case "http_poll": {
      const url = (config.url as string) || "<url>";
      const interval = (config.interval_seconds as number) || 300;
      const fireOnFirst = Boolean(config.fire_on_first);
      return [
        {
          title: "1. Vérifier l'URL surveillée",
          description: `RunFlow interroge cette URL toutes les ${interval}s et lance le job quand le contenu change :`,
          code: `curl -i '${url}'`,
        },
        {
          title: "2. Provoquer un changement",
          description: fireOnFirst
            ? "L'option « Lancer au premier poll » est active : le job démarrera au prochain relevé sans attendre de changement."
            : "Modifiez le contenu/valeur renvoyé par l'URL, puis attendez le prochain relevé. Astuce : activez « Lancer au premier poll » pour un test immédiat.",
        },
      ];
    }

    case "run_event": {
      const sourceJob = jobs.find((j) => j.id === (config.source_job_id as string));
      const statuses = (config.on_status as string[]) || ["success", "failed"];
      const steps: Step[] = [
        {
          title: "1. Principe",
          description: `Ce trigger lance ${targetJob?.name ?? "le job cible"} lorsque ${
            sourceJob?.name ?? "le job source"
          } se termine en : ${statuses.join(", ")}.`,
        },
      ];
      if (sourceJob) {
        steps.push({
          title: "2. Lancer le job source",
          description: "Exécutez le job source ; à sa fin, le job cible est enchaîné automatiquement.",
          code: runCurl(sourceJob.slug),
        });
      }
      return steps;
    }

    default:
      return [];
  }
}

function cronFromSimple(config: Record<string, unknown>): string {
  const interval = config.interval as string;
  const hour = Number(config.hour ?? 0);
  if (interval === "hourly") return "0 * * * *";
  if (interval === "daily") return `0 ${hour} * * *`;
  if (interval === "weekly") return `0 ${hour} * * 1`;
  if (interval === "every_minutes") return `*/${config.minutes ?? 5} * * * *`;
  return "0 * * * *";
}

export function TriggerTestGuide({ trigger, jobs }: { trigger: Trigger; jobs: Job[] }) {
  const steps = buildSteps(trigger, jobs);
  if (steps.length === 0) return null;

  return (
    <div className="mt-4 rounded-xl border border-border bg-background/40 p-4 space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Procédure de test
      </p>
      <ol className="space-y-3">
        {steps.map((step, i) => (
          <li key={i} className="space-y-1.5">
            <p className="text-sm font-medium">{step.title}</p>
            {step.description && (
              <p className="text-xs text-muted-foreground leading-relaxed">{step.description}</p>
            )}
            {step.code && <CopyBlock code={step.code} />}
          </li>
        ))}
      </ol>
    </div>
  );
}
