"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";

export function CopyRegistrationLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="grid min-w-0 w-full max-w-full gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <code className="block min-w-0 truncate rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs sm:text-sm">
        {url}
      </code>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 w-full shrink-0 sm:w-auto"
        onClick={copy}
      >
        {copied ? <Check /> : <Copy />}
        {copied ? "Copied" : "Copy link"}
      </Button>
    </div>
  );
}
