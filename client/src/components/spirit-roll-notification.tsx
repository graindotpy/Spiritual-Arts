import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle, Dice6, User, X, XCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
  const resultColor = roll.success
    ? "text-green-600 dark:text-green-400"
    : "text-red-600 dark:text-red-400";

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -100, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -100, scale: 0.8 }}
          transition={{ type: "spring", stiffness: 200, damping: 20, duration: 0.6 }}
          className="fixed right-4 top-4 z-50 max-w-sm"
          role="status"
          aria-live="polite"
        >
          <Card className="border-2 border-spiritual-200 bg-white shadow-lg dark:border-spiritual-700 dark:bg-gray-800">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Avatar className="h-10 w-10 border-2 border-spiritual-200 dark:border-spiritual-600">
                  <AvatarImage src={character.portraitUrl || undefined} alt="" />
                  <AvatarFallback className="bg-spiritual-100 dark:bg-spiritual-800">
                    <User className="h-5 w-5 text-spiritual-600 dark:text-spiritual-400" />
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex items-center gap-2">
                    <h4 className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                      {character.name}
                    </h4>
                    <Badge variant="outline" className="text-xs">
                      {character.path}
                    </Badge>
                  </div>
                  <div className="mb-2 flex items-center gap-2">
                    <Dice6 className="h-4 w-4 text-spiritual-600 dark:text-spiritual-400" />
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      Rolled {roll.dieSize} for {roll.spInvestment} SP
                    </span>
                  </div>
                  <div className={"flex items-center gap-2 " + resultColor}>
                    {roll.success ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    <span className="text-lg font-bold">{roll.value}</span>
                    <span className="text-sm font-medium">{roll.success ? "Success!" : "Failed"}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setVisible(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  aria-label="Dismiss roll notification"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
