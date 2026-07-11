"use client";

import { Suspense } from "react";
import ApiDocsPage from "./ApiDocsContent";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-muted-foreground">Chargement…</div>}>
      <ApiDocsPage />
    </Suspense>
  );
}
