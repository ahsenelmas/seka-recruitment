"use client";

import { useEffect, useState } from "react";
import { apiGet, RecruitmentStatus } from "@/lib/api";

export function useStatuses(language: "pl" | "en", refresh = 0) {
  const [statuses, setStatuses] = useState<RecruitmentStatus[]>([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController(); setError(false);
    apiGet<RecruitmentStatus[]>("/statuses", controller.signal)
      .then(data => { if (!controller.signal.aborted) setStatuses(data); })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [refresh]);
  const labels: Record<string, string> = Object.fromEntries(statuses.map(status => [status.code, language === "pl" ? status.label_pl : status.label_en]));
  function badgeStyle(code: string) {
    const color = statuses.find(status => status.code === code)?.color ?? "#475569";
    return { color, backgroundColor: `${color}18`, borderColor: `${color}55` };
  }
  return { statuses, labels, badgeStyle, error };
}
