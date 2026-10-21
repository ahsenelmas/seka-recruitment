"use client";
import { useSyncExternalStore } from "react";
export type Language = "pl" | "en";
const KEY = "seka-language";
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("seka-language-change", callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener("seka-language-change", callback); };
}
function snapshot(): Language {
  try { return localStorage.getItem(KEY) === "en" ? "en" : "pl"; } catch { return "pl"; }
}
export function useLanguage() {
  const language = useSyncExternalStore(subscribe, snapshot, (): Language => "pl");
  function changeLanguage(value: Language) {
    try { localStorage.setItem(KEY, value); } catch { /* Storage can be unavailable in private browsers. */ }
    window.dispatchEvent(new Event("seka-language-change"));
  }
  return [language, changeLanguage] as const;
}
