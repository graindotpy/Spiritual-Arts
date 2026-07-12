import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface RollResultNotificationProps {
  result: number | null;
  success?: boolean;
  isVisible: boolean;
}

export default function RollResultNotification({ 
  result, 
  success = true, 
  isVisible 
}: RollResultNotificationProps) {
  if (!isVisible || result === null) return null;

  return (
    <div
      className="fixed bottom-4 left-4 right-4 z-50 animate-in slide-in-from-bottom-4 duration-300 sm:left-auto sm:w-[17rem]"
      role="status"
      aria-live="polite"
    >
      <div
        className={cn(
          "relative flex items-center gap-3 overflow-hidden rounded-lg border bg-[#fbf6eb]/95 px-4 py-3.5 text-[#263a33] shadow-[0_18px_45px_rgba(57,43,26,0.22)] backdrop-blur-md dark:rounded-sm dark:bg-[#30281d]/95 dark:text-[#eee3ce] dark:shadow-[0_20px_50px_rgba(0,0,0,0.48)]",
          success
            ? "border-[#86a393]/70 dark:border-[#80947b]/55"
            : "border-[#ba8175]/70 dark:border-[#a9695d]/55",
        )}
      >
        <span
          className={cn(
            "absolute inset-y-0 left-0 w-1",
            success ? "bg-[#477564] dark:bg-[#8ba18a]" : "bg-[#9e5548] dark:bg-[#b56d5f]",
          )}
          aria-hidden="true"
        />
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border",
            success
              ? "border-[#7d9b8c]/45 bg-[#dce8df]/75 text-[#315f50] dark:border-[#8ca18d]/40 dark:bg-[#52624c]/25 dark:text-[#b8caae]"
              : "border-[#b77a6e]/45 bg-[#f0ddd6]/75 text-[#92493e] dark:border-[#aa685c]/40 dark:bg-[#7c3f35]/25 dark:text-[#dda196]",
          )}
          aria-hidden="true"
        >
          {success ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
        </span>
        <div className="min-w-0">
          <span className="wuxia-kicker block">Spirit die result</span>
          <div className="mt-0.5 flex items-baseline gap-2">
            <span className="font-display text-2xl leading-none">{result}</span>
            <span
              className={cn(
                "text-sm font-semibold",
                success
                  ? "text-[#376656] dark:text-[#b6c8ad]"
                  : "text-[#934c41] dark:text-[#dda196]",
              )}
            >
              {success ? "Success!" : "Failed"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
