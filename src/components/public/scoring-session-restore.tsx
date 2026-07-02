"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import {
  getScorePageHref,
  getScoringCode,
} from "@/lib/scoring-code-storage";

export function ScoringSessionRestore({ slug }: { slug: string }) {
  const router = useRouter();

  useEffect(() => {
    const code = getScoringCode(slug);
    if (code) {
      router.replace(getScorePageHref(slug, code));
    }
  }, [slug, router]);

  return null;
}
