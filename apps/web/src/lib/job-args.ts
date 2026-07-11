import { Job, JobParameter } from "@/lib/api";
import { parseEnvFile } from "@/lib/env-file";

function coerceArgValue(value: string): unknown {
  const v = value.trim();
  if (v === "true") return true;
  if (v === "false") return false;
  if (/^-?\d+$/.test(v)) return parseInt(v, 10);
  if (/^-?\d+\.\d+$/.test(v)) return parseFloat(v);
  if (
    (v.startsWith("{") && v.endsWith("}")) ||
    (v.startsWith("[") && v.endsWith("]"))
  ) {
    try {
      return JSON.parse(v);
    } catch {
      return v;
    }
  }
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    return v.slice(1, -1);
  }
  return v;
}

export function parseForcedArgumentsText(content: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const { key, value } of parseEnvFile(content)) {
    result[key] = coerceArgValue(value);
  }
  return result;
}

export function stringifyForcedArguments(args: Record<string, unknown>): string {
  return Object.entries(args)
    .map(([key, value]) => {
      if (typeof value === "string") return `${key}=${value}`;
      return `${key}=${JSON.stringify(value)}`;
    })
    .join("\n");
}

export function getForcedArgumentKeys(job: Job): Set<string> {
  return new Set(Object.keys(job.forced_arguments ?? {}));
}

export function getUserFacingParameters(job: Job): JobParameter[] {
  const forced = getForcedArgumentKeys(job);
  return job.parameters.filter(
    (p) => p.enabled !== false && !forced.has(p.name)
  );
}

export function canLaunchDirectly(job: Job): boolean {
  return getUserFacingParameters(job).length === 0;
}

export function defaultArgsFromJob(job: Job): Record<string, string> {
  const forced = getForcedArgumentKeys(job);
  const defaults: Record<string, string> = {};
  for (const p of getUserFacingParameters(job)) {
    if (p.default_value != null) defaults[p.name] = String(p.default_value);
    // A required present/absent flag defaults to "present" (true).
    else if (p.param_type === "flag") defaults[p.name] = p.required ? "true" : "false";
  }
  return defaults;
}

export function buildJobArguments(
  parameters: JobParameter[],
  rawArgs: Record<string, string>
): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  for (const p of parameters) {
    const raw = rawArgs[p.name];
    if (raw === undefined || raw === "") continue;
    if (p.param_type === "boolean" || p.param_type === "flag") args[p.name] = raw === "true";
    else if (p.param_type === "integer") args[p.name] = parseInt(raw, 10);
    else args[p.name] = raw;
  }
  return args;
}

export function buildRunArguments(
  job: Job,
  rawUserArgs: Record<string, string>
): Record<string, unknown> {
  const userFacing = getUserFacingParameters(job);
  const userBuilt = buildJobArguments(userFacing, rawUserArgs);
  return { ...userBuilt, ...(job.forced_arguments ?? {}) };
}
