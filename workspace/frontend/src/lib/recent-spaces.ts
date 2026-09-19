const KEY = "taskflow-recent-spaces";
const MAX = 8;

export type RecentSpace = {
  id: string;
  name: string;
  avatar?: string | null;
  visitedAt: number;
};

function read(): RecentSpace[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(items: RecentSpace[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)));
}

export function getRecentSpaces(): RecentSpace[] {
  return read().sort((a, b) => b.visitedAt - a.visitedAt);
}

export function pushRecentSpace(space: {
  id: string;
  name: string;
  avatar?: string | null;
}) {
  const next = read().filter((s) => s.id !== space.id);
  next.unshift({
    id: space.id,
    name: space.name,
    avatar: space.avatar ?? null,
    visitedAt: Date.now(),
  });
  write(next);
}
