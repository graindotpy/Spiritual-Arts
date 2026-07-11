import { cn } from "@/lib/utils";
import { CheckCircle, XCircle } from "lucide-react";

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
      className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-4 duration-300"
      role="status"
      aria-live="polite"
    >
      <div className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border backdrop-blur-sm",
        success 
          ? "bg-green-50/90 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-700 dark:text-green-300"
          : "bg-red-50/90 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-700 dark:text-red-300"
      )}>
        {success ? (
          <CheckCircle className="w-5 h-5" />
        ) : (
          <XCircle className="w-5 h-5" />
        )}
        <div className="flex flex-col">
          <span className="font-bold text-lg">{result}</span>
          <span className="text-sm">
            {success ? "Success!" : "Failed"}
          </span>
        </div>
      </div>
    </div>
  );
}
