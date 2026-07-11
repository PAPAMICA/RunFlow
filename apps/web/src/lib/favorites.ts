const STORAGE_KEY = "runflow_job_favorites";

export interface JobFavorite {
  jobId: string;
  addedAt: number;
  arguments?: Record<string, string>;
}

function readAll(): JobFavorite[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as JobFavorite[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(items: JobFavorite[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function getFavorites(): JobFavorite[] {
  return readAll().sort((a, b) => a.addedAt - b.addedAt);
}

export function isFavorite(jobId: string): boolean {
  return readAll().some((f) => f.jobId === jobId);
}

export function addFavorite(jobId: string) {
  if (isFavorite(jobId)) return;
  writeAll([...readAll(), { jobId, addedAt: Date.now() }]);
}

export function removeFavorite(jobId: string) {
  writeAll(readAll().filter((f) => f.jobId !== jobId));
}

export function toggleFavorite(jobId: string): boolean {
  if (isFavorite(jobId)) {
    removeFavorite(jobId);
    return false;
  }
  addFavorite(jobId);
  return true;
}

export function updateFavoriteArguments(jobId: string, arguments_: Record<string, string>) {
  const items = readAll();
  const idx = items.findIndex((f) => f.jobId === jobId);
  if (idx < 0) return;
  items[idx] = { ...items[idx], arguments: arguments_ };
  writeAll(items);
}

export function getFavoriteArguments(jobId: string): Record<string, string> | undefined {
  return readAll().find((f) => f.jobId === jobId)?.arguments;
}
