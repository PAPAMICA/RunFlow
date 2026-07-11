"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ApiKeysRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/api-docs?tab=keys");
  }, [router]);
  return null;
}
