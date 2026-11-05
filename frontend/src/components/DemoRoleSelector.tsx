"use client";
import { useEffect, useState } from "react";
import { apiGet, type DemoContext } from "@/lib/api";
export default function DemoRoleSelector({
  language,
  onContext,
}: {
  language: "pl" | "en";
  onContext?: (context: DemoContext) => void;
}) {
  const pl = language === "pl";
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    apiGet<DemoContext>("/demo/context", controller.signal)
      .then((data) => {
        onContext?.(data);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [onContext]);
  if (!error) return null;
  return (
    <p className="error" role="alert">
      {pl
        ? "Nie udało się pobrać uprawnień. Sprawdź połączenie z API."
        : "Could not load permissions. Check the API connection."}
    </p>
  );
}
