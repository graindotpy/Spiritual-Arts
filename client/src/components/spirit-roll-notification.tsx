import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Dice6, User, X, XCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { SpiritDieRollBroadcast } from "@/hooks/use-websocket";

interface SpiritRollNotificationProps {
  rollData: SpiritDieRollBroadcast | null;
  currentCharacterId?: string;
}

export default function SpiritRollNotification({
  rollData,
  currentCharacterId,
}: SpiritRollNotificationProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const shouldShow = Boolean(rollData && rollData.character.id !== currentCharacterId);
    setVisible(shouldShow);
    if (!shouldShow) return;

    const timer = setTimeout(() => setVisible(false), 8_000);
    return () => clearTimeout(timer);
  }, [currentCharacterId, rollData]);

  if (!rollData) return null;
  const { character, roll } = rollData;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -100, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -100, scale: 0.8 }}
          transition={{ type: "spring", stiffness: 200, damping: 20, duration: 0.6 }}
          className="fixed left-4 right-4 top-4 z-50 sm:left-auto sm:w-full sm:max-w-sm"
          role="status"
          aria-live="polite"
        >
          <div
            className={cn(
              "relative overflow-hidden rounded-xl border bg-[#fbf6eb]/95 p-4 text-[#263a33] shadow-[0_20px_55px_rgba(57,43,26,0.24)] backdrop-blur-md dark:rounded-sm dark:bg-[#30281d]/95 dark:text-[#eee3ce] dark:shadow-[0_22px_58px_rgba(0,0,0,0.52)]",
              roll.success
                ? "border-[#8ca494]/70 dark:border-[#80947b]/55"
                : "border-[#ba8175]/70 dark:border-[#a9695d]/55",
            )}
          >
            <span
              className={cn(
                "absolute inset-y-0 left-0 w-1",
                roll.success
                  ? "bg-[#477564] dark:bg-[#8ba18a]"
                  : "bg-[#9e5548] dark:bg-[#b56d5f]",
              )}
              aria-hidden="true"
            />
            <div className="flex items-start gap-3">
              <Avatar className="h-11 w-11 shrink-0 border border-[#9b896a]/55 shadow-sm dark:border-[#9c7d4f]/55">
                <AvatarImage src={character.portraitUrl || undefined} alt="" />
                <AvatarFallback className="bg-[#e3e6d9] text-[#42695c] dark:bg-[#4b4432] dark:text-[#cbb78f]">
                  <User className="h-5 w-5" />
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1">
                <p className="wuxia-kicker mb-1">A roll echoes nearby</p>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <h4 className="font-display truncate text-xl leading-none text-[#253b33] dark:text-[#f0e3ca]">
                    {character.name}
                  </h4>
                  <span className="rounded-sm border border-[#b9aa8e]/70 bg-[#f4ecdd]/75 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[#657068] dark:border-[#806640]/70 dark:bg-[#4d3e29]/35 dark:text-[#c7b28d]">
                    {character.path}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2 text-[#696c64] dark:text-[#b9aa8c]">
                  <Dice6 className="h-4 w-4 shrink-0 text-[#557d6f] dark:text-[#c0a16c]" />
                  <span className="text-sm leading-5">
                    Rolled {roll.dieSize} for {roll.spInvestment} SP
                  </span>
                </div>
                <div
                  className={cn(
                    "mt-2.5 flex items-center gap-2",
                    roll.success
                      ? "text-[#376656] dark:text-[#b6c8ad]"
                      : "text-[#934c41] dark:text-[#dda196]",
                  )}
                >
                  {roll.success ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  <span className="font-display text-2xl leading-none">{roll.value}</span>
                  <span className="text-sm font-medium">
                    {roll.success ? "Success!" : "Failed"}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setVisible(false)}
                className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-[#887d6b] transition-colors hover:bg-[#e7ddca]/70 hover:text-[#374a42] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#557d6f] dark:text-[#a99676] dark:hover:bg-[#5a4931]/45 dark:hover:text-[#ead9b6]"
                aria-label="Dismiss roll notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
