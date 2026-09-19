/** Space = Project. Canonical routes under /spaces. */

export function spaceHref(id: string, tab?: string) {
  if (!tab || tab === "summary") return `/spaces/${id}`;
  return `/spaces/${id}/${tab}`;
}

export const SPACE_TABS = [
  { id: "summary", label: "Summary", href: (id: string) => spaceHref(id) },
  { id: "board", label: "Board", href: (id: string) => spaceHref(id, "board") },
  { id: "list", label: "List", href: (id: string) => spaceHref(id, "list") },
  { id: "calendar", label: "Calendar", href: (id: string) => spaceHref(id, "calendar") },
  {
    id: "timeline",
    label: "Timeline",
    href: (id: string) => spaceHref(id, "timeline"),
    stub: true,
  },
  { id: "docs", label: "Docs", href: (id: string) => spaceHref(id, "docs") },
  {
    id: "attachments",
    label: "Attachments",
    href: (id: string) => spaceHref(id, "attachments"),
    stub: true,
  },
  { id: "reports", label: "Reports", href: (id: string) => spaceHref(id, "reports") },
] as const;

export type SpaceTabId = (typeof SPACE_TABS)[number]["id"];

export function activeSpaceTab(pathname: string): SpaceTabId {
  const match = pathname.match(/\/spaces\/[^/]+(?:\/([^/]+))?/);
  const seg = match?.[1];
  if (!seg) return "summary";
  const found = SPACE_TABS.find((t) => t.id === seg);
  return found?.id ?? "summary";
}
