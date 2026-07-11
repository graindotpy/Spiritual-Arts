import { useState } from "react";
import { ChevronDown, ChevronUp, Edit2, Trash2 } from "lucide-react";
import TooltipText from "@/components/tooltip-text";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dmGlossaryScope } from "@/hooks/use-glossary";
import type { DmStack } from "@shared/schema";

interface StackCardProps {
  stack: DmStack;
  userId: string;
  onEdit: (stack: DmStack) => void;
  onDelete: (id: string) => void;
}

export function StackCard({ stack, userId, onEdit, onDelete }: StackCardProps) {
  const [counter, setCounter] = useState(0);

  return (
    <Card
      className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
      data-testid={`card-stack-${stack.id}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg text-spiritual-700 dark:text-spiritual-400">
            {stack.name}
          </CardTitle>
          <div className="flex gap-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onEdit(stack)}
              aria-label={`Edit ${stack.name}`}
              data-testid={`button-edit-stack-${stack.id}`}
            >
              <Edit2 className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onDelete(stack.id)}
              aria-label={`Delete ${stack.name}`}
              data-testid={`button-delete-stack-${stack.id}`}
            >
              <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
            Target
          </h4>
          <p className="text-gray-900 dark:text-white whitespace-pre-line">
            {stack.target}
          </p>
        </div>

        <div className="flex items-center justify-center py-2">
          <div className="flex flex-col items-center">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setCounter((value) => value + 1)}
              className="h-6 w-6 p-0"
              aria-label={`Increase ${stack.name} counter`}
              data-testid={`button-increment-${stack.id}`}
            >
              <ChevronUp className="w-4 h-4" />
            </Button>
            <span
              className="text-2xl font-bold text-spiritual-700 dark:text-spiritual-400 my-1"
              aria-live="polite"
            >
              {counter}
            </span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setCounter((value) => Math.max(value - 1, 0))}
              className="h-6 w-6 p-0"
              aria-label={`Decrease ${stack.name} counter`}
              data-testid={`button-decrement-${stack.id}`}
            >
              <ChevronDown className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
            Effect
          </h4>
          <TooltipText
            text={stack.effect}
            entityId={userId}
            scope={dmGlossaryScope}
            className="text-gray-900 dark:text-white"
          />
        </div>
      </CardContent>
    </Card>
  );
}
