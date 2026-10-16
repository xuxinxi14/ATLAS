export type RouteView = "boot" | "home" | "archive" | "library" | "reader";

export interface ParsedRoute {
  view: RouteView;
  slug?: string;
  category?: string;
  anchor?: string;
  query?: string;
}

export function parseHashRoute(rawHash: string): ParsedRoute | null {
  const trimmed = rawHash.replace(/^#/, "").trim();
  if (!trimmed || trimmed === "/") return null;

  const [pathPart, queryString] = trimmed.split("?");
  const params = new URLSearchParams(queryString ?? "");
  const cleanPath = pathPart.replace(/^\/+|\/+$/g, "");

  if (cleanPath === "home" || cleanPath === "telemetry" || cleanPath === "overview") {
    return { view: "home" };
  }
  if (cleanPath === "archive" || cleanPath === "3d") {
    return {
      view: "archive",
      category: params.get("category") ?? undefined,
    };
  }
  if (cleanPath === "library" || cleanPath.startsWith("library/")) {
    const subCat = cleanPath.slice("library".length).replace(/^\/+/, "");
    return {
      view: "library",
      category: subCat || params.get("category") || "all",
      query: params.get("q") ?? undefined,
    };
  }
  if (cleanPath.startsWith("entry/")) {
    const rest = cleanPath.slice("entry/".length);
    const [slugPart, anchor] = rest.split("#");
    return {
      view: "reader",
      slug: decodeURIComponent(slugPart),
      anchor: anchor ? decodeURIComponent(anchor) : params.get("section") ?? undefined,
    };
  }
  return null;
}

export function buildEntryHash(slug: string): string {
  return `#/entry/${slug.replace(/^\/+|\/+$/g, "")}`;
}

export function buildLibraryHash(category = "all"): string {
  return category && category !== "all"
    ? `#/library/${encodeURIComponent(category)}`
    : "#/library";
}
