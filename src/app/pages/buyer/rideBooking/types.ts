/** How a route endpoint got its coordinates (mirrors BookRide semantics). */
export type RoutePointSource = "none" | "suggestion" | "gps" | "map";

export function normRouteAddr(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}
