import { Suspense } from "react";
import CandidateProfileClient from "./profile-client";

export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="workspace">
          <p className="empty-state">Ładowanie… / Loading…</p>
        </main>
      }
    >
      <CandidateProfileClient />
    </Suspense>
  );
}
