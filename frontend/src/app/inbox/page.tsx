import { Suspense } from "react";
import InboxClient from "./inbox-client";
export default function InboxPage() {
  return <Suspense fallback={<p className="empty-state">Ładowanie / Loading…</p>}><InboxClient /></Suspense>;
}
