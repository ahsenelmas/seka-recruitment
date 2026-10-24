import type { CSSProperties } from "react";
const PATHS: Record<string, string> = {
  tasks: "M9 4h12 M9 12h12 M9 20h12 M2 3l2 2 3-3 M2 11l2 2 3-3 M2 19l2 2 3-3",
  overview: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  inbox: "M3 5h18v14H3z M3 6l9 7 9-7",
  profile: "M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2 M9 3a4 4 0 110 8 4 4 0 010-8 M17 4a4 4 0 010 7 M22 21v-2a4 4 0 00-3-3.87",
  intake: "M12 5v14 M5 12h14",
  statuses: "M4 6h16 M4 12h16 M4 18h16 M8 3v6 M16 9v6 M10 15v6",
  roles: "M12 3l8 4v5c0 5-8 9-8 9s-8-4-8-9V7z M8 12l3 3 5-6",
  system: "M12 8a4 4 0 110 8 4 4 0 010-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2",
  search: "M10 3a7 7 0 110 14 7 7 0 010-14 M15 15l6 6",
  arrow: "M5 12h14 M13 6l6 6-6 6",
};
export default function WorkspaceIcon({ name, style }: { name: string; style?: CSSProperties }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}><path d={PATHS[name] ?? PATHS.inbox} /></svg>;
}
