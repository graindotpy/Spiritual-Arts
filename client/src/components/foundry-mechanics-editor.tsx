import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Dice6,
  HeartPulse,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DAMAGE_TYPES,
  FOUNDRY_MECHANICS_VERSION,
  MAX_FOUNDRY_ACTIONS,
  foundryActionSchema,
  type DamageType,
  type FoundryAction,
  type FoundryMechanics,
} from "@shared/mechanics";
import {
  createFoundryAction,
  moveFoundryAction,
  normalizeFoundryMechanics,
} from "@/lib/foundry-mechanics-draft";

interface FoundryMechanicsEditorProps {
  mechanics?: FoundryMechanics;
  onChange: (mechanics: FoundryMechanics | undefined) => void;
  tierLabel: string;
  storedMechanicsError?: string;
  onDiscardStoredMechanics: () => void;
}

function actionError(action: FoundryAction): string | null {
  const normalized = normalizeFoundryMechanics({
    version: FOUNDRY_MECHANICS_VERSION,
    actions: [action],
  });
  const parsed = foundryActionSchema.safeParse(normalized?.actions[0]);
  if (parsed.success) return null;
  return parsed.error.issues[0]?.message ?? "Check this Foundry action";
}

function actionTitle(action: FoundryAction): string {
  return action.kind === "roll_damage" ? "Damage roll" : "Healing roll";
}

function damageTypeLabel(value: DamageType): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

export default function FoundryMechanicsEditor({
  mechanics,
  onChange,
  tierLabel,
  storedMechanicsError,
  onDiscardStoredMechanics,
}: FoundryMechanicsEditorProps) {
  const actions = mechanics?.actions ?? [];

  const setActions = (nextActions: FoundryAction[]) => {
    onChange(
      nextActions.length > 0
        ? { version: FOUNDRY_MECHANICS_VERSION, actions: nextActions }
        : undefined,
    );
  };

  const addAction = (kind: FoundryAction["kind"]) => {
    if (actions.length >= MAX_FOUNDRY_ACTIONS) return;
    setActions([...actions, createFoundryAction(kind)]);
  };

  const replaceAction = (actionId: string, action: FoundryAction) => {
    setActions(
      actions.map((candidate) => (candidate.id === actionId ? action : candidate)),
    );
  };

  const removeAction = (actionId: string) => {
    setActions(actions.filter((action) => action.id !== actionId));
  };

  const moveAction = (index: number, offset: -1 | 1) => {
    setActions(moveFoundryAction(actions, index, offset));
  };

  return (
    <details className="group rounded-sm border border-[#b9aa8f] bg-[#fffaf0]/35 dark:border-[#806b48] dark:bg-[#30291f]/45">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 text-left marker:hidden sm:px-4 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="wuxia-dialog-label mb-0 block text-[#40564c] dark:text-[#dfc99e]">
            Foundry mechanics
          </span>
          <span className="mt-1 block text-xs leading-5 text-[#68736d] dark:text-[#b8aa91]">
            Runs in Foundry after a Spirit Die roll for this tier, whether it
            succeeds or fails.
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="rounded-sm border border-[#b9aa8f] bg-[#eee5d2]/70 px-2 py-0.5 text-xs font-semibold text-[#526159] dark:border-[#806b48] dark:bg-[#493a25]/60 dark:text-[#cdbb99]">
            {storedMechanicsError
              ? "Needs attention"
              : `${actions.length} ${actions.length === 1 ? "roll" : "rolls"}`}
          </span>
          <ChevronDown className="h-4 w-4 text-[#667069] transition-transform group-open:rotate-180 dark:text-[#c5b18d]" />
        </span>
      </summary>

      <div className="space-y-3 border-t border-[#c8baa1]/75 px-3 py-4 dark:border-[#6f5d40] sm:px-4">
        {storedMechanicsError ? (
          <div
            className="rounded-sm border border-destructive/50 bg-destructive/5 px-3 py-3 text-sm"
            role="alert"
          >
            <p className="font-semibold text-destructive">
              Stored mechanics cannot be edited
            </p>
            <p className="mt-1 text-xs leading-5 text-[#68736d] dark:text-[#b8aa91]">
              {storedMechanicsError} Saving is blocked until you deliberately discard
              this unsupported mechanics block.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="wuxia-secondary-action mt-3"
              onClick={onDiscardStoredMechanics}
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Discard stored mechanics
            </Button>
          </div>
        ) : actions.length === 0 ? (
          <div className="rounded-sm border border-dashed border-[#b9aa8f] bg-[#f6efdf]/45 px-3 py-4 text-center text-sm text-[#68736d] dark:border-[#806b48] dark:bg-[#3c3224]/35 dark:text-[#b8aa91]">
            No Foundry rolls are configured for {tierLabel}.
          </div>
        ) : (
          actions.map((action, index) => {
            const formulaId = `foundry-formula-${action.id}`;
            const damageTypeId = `foundry-damage-type-${action.id}`;
            const labelId = `foundry-label-${action.id}`;
            const error = actionError(action);

            return (
              <div
                key={action.id}
                className="rounded-sm border border-[#c5b79d] bg-[#fffdf7]/65 p-3 dark:border-[#745f3e] dark:bg-[#342b20]/65"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[#40564c] dark:text-[#dfc99e]">
                    {action.kind === "roll_damage" ? (
                      <Dice6 className="h-4 w-4" />
                    ) : (
                      <HeartPulse className="h-4 w-4" />
                    )}
                    {actionTitle(action)} {index + 1}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="wuxia-icon-action h-8 w-8"
                      onClick={() => moveAction(index, -1)}
                      disabled={index === 0}
                      aria-label={`Move ${actionTitle(action).toLowerCase()} ${index + 1} up`}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="wuxia-icon-action h-8 w-8"
                      onClick={() => moveAction(index, 1)}
                      disabled={index === actions.length - 1}
                      aria-label={`Move ${actionTitle(action).toLowerCase()} ${index + 1} down`}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="wuxia-icon-action wuxia-icon-danger h-8 w-8"
                      onClick={() => removeAction(action.id)}
                      aria-label={`Remove ${actionTitle(action).toLowerCase()} ${index + 1}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor={formulaId} className="wuxia-dialog-label">
                      Formula
                    </Label>
                    <Input
                      id={formulaId}
                      value={action.formula}
                      onChange={(event) =>
                        replaceAction(action.id, { ...action, formula: event.target.value })
                      }
                      placeholder="2d8 + 4"
                      maxLength={200}
                      aria-required="true"
                      aria-invalid={error ? true : undefined}
                      aria-describedby={error ? `${formulaId}-error` : undefined}
                      className="wuxia-dialog-control font-mono"
                    />
                  </div>

                  {action.kind === "roll_damage" ? (
                    <div>
                      <Label htmlFor={damageTypeId} className="wuxia-dialog-label">
                        Damage type
                      </Label>
                      <Select
                        value={action.damageType}
                        onValueChange={(damageType: DamageType) =>
                          replaceAction(action.id, { ...action, damageType })
                        }
                      >
                        <SelectTrigger id={damageTypeId} className="wuxia-dialog-control w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="wuxia-select-content">
                          {DAMAGE_TYPES.map((damageType) => (
                            <SelectItem key={damageType} value={damageType}>
                              {damageTypeLabel(damageType)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}

                  <div className="sm:col-span-2">
                    <Label htmlFor={labelId} className="wuxia-dialog-label">
                      Label <span className="normal-case tracking-normal">(optional)</span>
                    </Label>
                    <Input
                      id={labelId}
                      value={action.label ?? ""}
                      onChange={(event) =>
                        replaceAction(action.id, { ...action, label: event.target.value })
                      }
                      placeholder="e.g. Devour Essence"
                      maxLength={255}
                      className="wuxia-dialog-control"
                    />
                  </div>
                </div>

                {error ? (
                  <p
                    id={`${formulaId}-error`}
                    className="mt-2 text-xs font-medium text-destructive"
                    role="alert"
                  >
                    {error}
                  </p>
                ) : null}
              </div>
            );
          })
        )}

        {!storedMechanicsError ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              type="button"
              variant="outline"
              className="wuxia-add-row h-10"
              onClick={() => addAction("roll_damage")}
              disabled={actions.length >= MAX_FOUNDRY_ACTIONS}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add damage roll
            </Button>
            <Button
              type="button"
              variant="outline"
              className="wuxia-add-row h-10"
              onClick={() => addAction("roll_healing")}
              disabled={actions.length >= MAX_FOUNDRY_ACTIONS}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add healing roll
            </Button>
          </div>
        ) : null}
        {!storedMechanicsError && actions.length >= MAX_FOUNDRY_ACTIONS ? (
          <p className="text-xs text-[#68736d] dark:text-[#b8aa91]">
            This tier has reached the {MAX_FOUNDRY_ACTIONS}-roll limit.
          </p>
        ) : null}
      </div>
    </details>
  );
}
