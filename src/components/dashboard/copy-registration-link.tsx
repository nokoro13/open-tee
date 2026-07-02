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
    <div className="flex flex-col gap-2 sm:flex-row">
      <code className="flex-1 truncate rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs sm:text-sm">
        {url}
      </code>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 shrink-0"
        onClick={copy}
      >
        {copied ? <Check /> : <Copy />}
        {copied ? "Copied" : "Copy link"}
      </Button>
    </div>
  );
}
