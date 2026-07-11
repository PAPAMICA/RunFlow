export interface EnvVar {
  key: string;
  value: string;
}

export function parseEnvFile(content: string): EnvVar[] {
  const vars: EnvVar[] = [];
  const seen = new Set<string>();
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    vars.push({ key, value });
  }
  return vars;
}

export function stringifyEnvFile(vars: EnvVar[]): string {
  return vars
    .filter((v) => v.key.trim())
    .map((v) => `${v.key.trim()}=${v.value}`)
    .join("\n");
}

/** Pre-fill from .env.example: keep keys, clear values unless safe default. */
export function envExampleToForm(content: string): EnvVar[] {
  return parseEnvFile(content).map((v) => ({
    key: v.key,
    value: v.value || "",
  }));
}

export function envExampleToText(content: string): string {
  return envExampleToForm(content)
    .map((v) => `${v.key}=`)
    .join("\n");
}
