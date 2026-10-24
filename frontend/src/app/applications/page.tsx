import { Suspense } from "react";
import ApplicationsClient from "./applications-client";
export default function ApplicationsPage() {
  return <Suspense fallback={<p className="empty-state">Ładowanie / Loading…</p>}><ApplicationsClient /></Suspense>;
}
