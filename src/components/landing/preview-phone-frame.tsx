import { cn } from "@/lib/utils";

/** Full device ratio (390×844pt iPhone). Screen content lives below the notch. */
export const PHONE_FRAME_ASPECT = "390/844";
export const PHONE_NOTCH_OFFSET = "2.75rem"; // pt-11

type PreviewPhoneFrameProps = {
  className?: string;
  children: React.ReactNode;
};

export function PreviewPhoneFrame({
  className,
  children,
}: PreviewPhoneFrameProps) {
  return (
    <div
      className={cn(
        "relative isolate aspect-[390/844] w-full overflow-hidden rounded-[2rem] border-[3px] border-white/25 bg-white text-foreground shadow-2xl ring-1 ring-black/10 [color-scheme:light]",
        className
      )}
    >
      <div
        className="pointer-events-none absolute left-1/2 top-2.5 z-20 h-[22px] w-[76px] -translate-x-1/2 rounded-full bg-black"
        aria-hidden
      />
      <div className="absolute inset-x-0 bottom-0 top-11 overflow-hidden rounded-b-[1.65rem] bg-background">
        {children}
      </div>
    </div>
  );
}
