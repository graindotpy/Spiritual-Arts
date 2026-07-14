import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  CircleAlert,
  Crosshair,
  Dice6,
  HeartPulse,
  ListOrdered,
  Plus,
  Settings2,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useEffect, useId, useState } from "react";
import {
  CampaignDialogBody,
  CampaignDialogContent,
  CampaignDialogFooter,
  CampaignDialogHeader,
} from "@/components/campaign-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
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
  FOUNDRY_TEMPLATE_TYPES,
  FOUNDRY_MECHANICS_VERSION,
  MAX_FOUNDRY_ACTIONS,
  MAX_FOUNDRY_TEMPLATE_ANGLE,
  MAX_FOUNDRY_TEMPLATE_DISTANCE,
  SAVING_THROW_ABILITIES,
  foundryActionSchema,
  type DamageType,
  type FoundryAction,
  type FoundryMeasuredTemplate,
  type FoundryMechanics,
  type SavingThrowAbility,
} from "@shared/mechanics";
import {
  createFoundryAction,
  moveFoundryAction,
  normalizeFoundryMechanics,
} from "@/lib/foundry-mechanics-draft";
import { cn } from "@/lib/utils";

interface FoundryMechanicsEditorProps {
  mechanics?: FoundryMechanics;
  onChange: (mechanics: FoundryMechanics | undefined) => void;
  tierLabel: string;
  storedMechanicsError?: string;
  onDiscardStoredMechanics: () => void;
}

interface ActionValidationError {
  message: string;
  path: PropertyKey[];
}

function actionError(action: FoundryAction): ActionValidationError | null {
  const normalized = normalizeFoundryMechanics({
    version: FOUNDRY_MECHANICS_VERSION,
    actions: [action],
  });
  const parsed = foundryActionSchema.safeParse(normalized?.actions[0]);
  if (parsed.success) return null;
  const issue = parsed.error.issues[0];
  return {
    message: issue?.message ?? "Check this Foundry action",
    path: issue?.path ?? [],
  };
}

function actionTitle(action: FoundryAction): string {
  switch (action.kind) {
    case "roll_damage":
      return "Damage roll";
    case "roll_healing":
      return "Healing roll";
    case "saving_throw":
      return "Saving throw";
    case "roll_attack":
      return "Attack roll";
  }
}

function damageTypeLabel(value: DamageType): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

const SAVING_THROW_LABELS: Record<SavingThrowAbility, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

const TEMPLATE_TYPE_LABELS: Record<FoundryMeasuredTemplate["type"], string> = {
  circle: "Circle",
  cone: "Cone",
  rectangle: "Rectangle",
  ray: "Ray",
};

function setSavingThrow(
  action: FoundryAction,
  ability: SavingThrowAbility | undefined,
): FoundryAction {
  if (action.kind === "roll_attack") return action;

  if (action.kind === "saving_throw") {
    return {
      ...action,
      savingThrow: { ability: ability ?? action.savingThrow.ability },
    };
  }

  const nextAction = { ...action };
  if (ability) {
    nextAction.savingThrow = { ability };
  } else {
    delete nextAction.savingThrow;
  }
  return nextAction;
}

function createMeasuredTemplate(
  type: FoundryMeasuredTemplate["type"],
): FoundryMeasuredTemplate {
  switch (type) {
    case "circle":
    case "rectangle":
      return { type, distance: 5 };
    case "cone":
      return { type, distance: 5, angle: 53 };
    case "ray":
      return { type, distance: 5, width: 5 };
  }
}

function setMeasuredTemplate(
  action: FoundryAction,
  type: FoundryMeasuredTemplate["type"] | undefined,
): FoundryAction {
  if (action.kind === "roll_attack") return action;

  const nextAction = { ...action };
  if (type) {
    nextAction.template = createMeasuredTemplate(type);
  } else {
    delete nextAction.template;
  }
  return nextAction;
}

function setTemplateDistance(
  action: FoundryAction,
  distance: number,
): FoundryAction {
  if (action.kind === "roll_attack") return action;
  if (!action.template) return action;
  return {
    ...action,
    template: { ...action.template, distance },
  };
}

function setConeAngle(action: FoundryAction, angle: number): FoundryAction {
  if (action.kind === "roll_attack") return action;
  if (action.template?.type !== "cone") return action;
  return {
    ...action,
    template: { ...action.template, angle },
  };
}

function setRayWidth(action: FoundryAction, width: number): FoundryAction {
  if (action.kind === "roll_attack") return action;
  if (action.template?.type !== "ray") return action;
  return {
    ...action,
    template: { ...action.template, width },
  };
}

function templateDistanceLabel(type: FoundryMeasuredTemplate["type"]): string {
  if (type === "circle") return "Radius (feet)";
  if (type === "rectangle") return "Size (feet)";
  return "Length (feet)";
}

function FoundryActionIcon({
  kind,
  className,
}: {
  kind: FoundryAction["kind"];
  className?: string;
}) {
  if (kind === "roll_damage") return <Dice6 className={className} />;
  if (kind === "roll_healing") return <HeartPulse className={className} />;
  if (kind === "saving_throw") return <ShieldCheck className={className} />;
  return <Crosshair className={className} />;
}

function actionsSummary(actions: FoundryAction[]): string {
  if (actions.length === 0) return "No actions configured";

  const visibleActions = actions.slice(0, 2).map(actionTitle);
  const remainingActions = actions.length - visibleActions.length;
  return remainingActions > 0
    ? `${visibleActions.join(" · ")} · +${remainingActions} more`
    : visibleActions.join(" · ");
}

export default function FoundryMechanicsEditor({
  mechanics,
  onChange,
  tierLabel,
  storedMechanicsError,
  onDiscardStoredMechanics,
}: FoundryMechanicsEditorProps) {
  const actions = mechanics?.actions ?? [];
  const [isOpen, setIsOpen] = useState(false);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(
    actions[0]?.id ?? null,
  );
  const addActionId = useId();
  const editorPanelId = useId();

  useEffect(() => {
    if (
      selectedActionId &&
      actions.some((action) => action.id === selectedActionId)
    ) {
      return;
    }

    setSelectedActionId(actions[0]?.id ?? null);
  }, [actions, selectedActionId]);

  const setActions = (nextActions: FoundryAction[]) => {
    onChange(
      nextActions.length > 0
        ? { version: FOUNDRY_MECHANICS_VERSION, actions: nextActions }
        : undefined,
    );
  };

  const addAction = (kind: FoundryAction["kind"]) => {
    if (actions.length >= MAX_FOUNDRY_ACTIONS) return;
    const nextAction = createFoundryAction(kind);
    setActions([...actions, nextAction]);
    setSelectedActionId(nextAction.id);
  };

  const replaceAction = (actionId: string, action: FoundryAction) => {
    setActions(
      actions.map((candidate) =>
        candidate.id === actionId ? action : candidate,
      ),
    );
  };

  const removeAction = (actionId: string) => {
    const removedIndex = actions.findIndex((action) => action.id === actionId);
    const nextActions = actions.filter((action) => action.id !== actionId);
    setActions(nextActions);

    if (selectedActionId === actionId) {
      const nextSelectedIndex = Math.min(removedIndex, nextActions.length - 1);
      setSelectedActionId(nextActions[nextSelectedIndex]?.id ?? null);
    }
  };

  const moveAction = (index: number, offset: -1 | 1) => {
    setActions(moveFoundryAction(actions, index, offset));
  };

  const selectedActionIndex = actions.findIndex(
    (action) => action.id === selectedActionId,
  );
  const selectedAction = actions[selectedActionIndex];
  const selectedActionError = selectedAction
    ? actionError(selectedAction)
    : null;
  const validationErrorCount = actions.reduce(
    (count, action) => count + (actionError(action) ? 1 : 0),
    0,
  );

  const formulaId = selectedAction
    ? `foundry-formula-${selectedAction.id}`
    : undefined;
  const damageTypeId = selectedAction
    ? `foundry-damage-type-${selectedAction.id}`
    : undefined;
  const labelId = selectedAction
    ? `foundry-label-${selectedAction.id}`
    : undefined;
  const savingThrowId = selectedAction
    ? `foundry-saving-throw-${selectedAction.id}`
    : undefined;
  const templateTypeId = selectedAction
    ? `foundry-template-type-${selectedAction.id}`
    : undefined;
  const templateDistanceId = selectedAction
    ? `foundry-template-distance-${selectedAction.id}`
    : undefined;
  const templateAngleId = selectedAction
    ? `foundry-template-angle-${selectedAction.id}`
    : undefined;
  const templateWidthId = selectedAction
    ? `foundry-template-width-${selectedAction.id}`
    : undefined;
  const errorId = selectedAction
    ? `foundry-action-error-${selectedAction.id}`
    : undefined;
  const hasErrorAt = (field: string, nestedField?: string) =>
    selectedActionError?.path[0] === field &&
    (nestedField === undefined ||
      selectedActionError.path[1] === nestedField);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "group h-auto w-full justify-start gap-3 rounded-sm border-[var(--wuxia-dialog-line)] bg-transparent px-3 py-3 text-left text-[var(--wuxia-dialog-ink)] shadow-none hover:bg-[var(--wuxia-dialog-field)] hover:text-[var(--wuxia-dialog-ink)] sm:px-4",
            storedMechanicsError && "border-destructive/55",
          )}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--wuxia-dialog-line)] bg-[var(--wuxia-dialog-field)] dark:rounded-sm">
            <Settings2 className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="wuxia-dialog-label mb-0 block">
              Foundry mechanics
            </span>
            <span className="mt-1 block truncate text-xs font-normal text-[var(--wuxia-dialog-muted)]">
              {storedMechanicsError
                ? "Stored setup needs attention"
                : validationErrorCount > 0
                  ? `${validationErrorCount} ${validationErrorCount === 1 ? "action needs" : "actions need"} attention`
                  : actionsSummary(actions)}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <span
              className={cn(
                "rounded-sm border border-[var(--wuxia-dialog-line)] bg-[var(--wuxia-dialog-field)] px-2 py-0.5 text-xs font-semibold text-[var(--wuxia-dialog-muted)]",
                (storedMechanicsError || validationErrorCount > 0) &&
                  "border-destructive/45 text-destructive",
              )}
            >
              {storedMechanicsError
                ? "Needs attention"
                : `${actions.length} ${actions.length === 1 ? "action" : "actions"}`}
            </span>
            <span className="hidden text-xs font-semibold sm:inline">
              Configure
            </span>
            <ChevronRight
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </span>
        </Button>
      </DialogTrigger>

      <CampaignDialogContent className="h-[min(92dvh,52rem)] max-w-5xl">
        <CampaignDialogHeader
          icon={Settings2}
          eyebrow={`${tierLabel} investment`}
          title="Foundry mechanics"
          description="Build the actions Foundry runs after this tier's Spirit Die roll, whether the roll succeeds or fails."
          actions={
            <span
              className={cn(
                "rounded-sm border border-[var(--wuxia-dialog-line)] bg-[var(--wuxia-dialog-field)] px-2.5 py-1 text-xs font-semibold text-[var(--wuxia-dialog-muted)]",
                (storedMechanicsError || validationErrorCount > 0) &&
                  "border-destructive/45 text-destructive",
              )}
            >
              {storedMechanicsError
                ? "Needs attention"
                : `${actions.length} of ${MAX_FOUNDRY_ACTIONS} actions`}
            </span>
          }
        />

        {storedMechanicsError ? (
          <CampaignDialogBody>
            <div
              className="mx-auto max-w-2xl border-l-2 border-destructive/60 bg-destructive/5 px-4 py-4 text-sm"
              role="alert"
            >
              <div className="flex items-start gap-3">
                <CircleAlert
                  className="mt-0.5 h-5 w-5 shrink-0 text-destructive"
                  aria-hidden="true"
                />
                <div>
                  <p className="font-semibold text-destructive">
                    Stored mechanics cannot be edited
                  </p>
                  <p className="mt-1 leading-6 text-[var(--wuxia-dialog-muted)]">
                    {storedMechanicsError} Saving is blocked until you
                    deliberately discard this unsupported mechanics block.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="wuxia-secondary-action mt-4"
                    onClick={onDiscardStoredMechanics}
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    Discard stored mechanics
                  </Button>
                </div>
              </div>
            </div>
          </CampaignDialogBody>
        ) : (
          <CampaignDialogBody className="foundry-mechanics-workspace lg:overflow-hidden">
            <div className="lg:grid lg:h-full lg:min-h-0 lg:grid-cols-[17rem_minmax(0,1fr)]">
              <aside className="border-b border-[var(--wuxia-dialog-line)] px-4 py-4 lg:min-h-0 lg:overflow-y-auto lg:border-b-0 lg:border-r">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="wuxia-dialog-kicker">Sequence</p>
                    <h3 className="flex items-center gap-2 font-semibold text-[var(--wuxia-dialog-ink)]">
                      <ListOrdered className="h-4 w-4" aria-hidden="true" />
                      Foundry actions
                    </h3>
                  </div>
                  <span className="text-xs text-[var(--wuxia-dialog-muted)]">
                    {actions.length}/{MAX_FOUNDRY_ACTIONS}
                  </span>
                </div>

                {actions.length > 0 ? (
                  <ol
                    className="flex gap-2 overflow-x-auto pb-2 lg:block lg:divide-y lg:divide-[var(--wuxia-dialog-line)] lg:overflow-visible lg:border-y lg:border-[var(--wuxia-dialog-line)] lg:pb-0"
                    aria-label="Foundry action sequence"
                  >
                    {actions.map((action, index) => {
                      const isSelected = action.id === selectedActionId;
                      const error = actionError(action);
                      return (
                        <li
                          key={action.id}
                          className="min-w-[11.5rem] shrink-0 lg:min-w-0"
                        >
                          <button
                            type="button"
                            className={cn(
                              "flex w-full items-center gap-2.5 rounded-sm border px-3 py-2.5 text-left transition-colors lg:rounded-none lg:border-0 lg:border-l-2",
                              isSelected
                                ? "border-[#507565] bg-[#dfe8dc]/70 text-[#284e41] dark:border-[#b48b52] dark:bg-[#654a2d]/40 dark:text-[#ead8b5]"
                                : "border-[var(--wuxia-dialog-line)] border-l-transparent text-[var(--wuxia-dialog-muted)] hover:bg-[var(--wuxia-dialog-field)] hover:text-[var(--wuxia-dialog-ink)]",
                            )}
                            onClick={() => setSelectedActionId(action.id)}
                            aria-current={isSelected ? "true" : undefined}
                            aria-controls={editorPanelId}
                          >
                            <FoundryActionIcon
                              kind={action.kind}
                              className="h-4 w-4 shrink-0"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-semibold">
                                {index + 1}. {actionTitle(action)}
                              </span>
                              {action.label?.trim() ? (
                                <span className="mt-0.5 block truncate text-xs font-normal opacity-75">
                                  {action.label}
                                </span>
                              ) : null}
                            </span>
                            {error ? (
                              <>
                                <CircleAlert
                                  className="h-4 w-4 shrink-0 text-destructive"
                                  aria-hidden="true"
                                />
                                <span className="sr-only">Needs attention</span>
                              </>
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <p className="border-y border-[var(--wuxia-dialog-line)] py-4 text-sm leading-6 text-[var(--wuxia-dialog-muted)]">
                    Start by choosing the first action Foundry should run.
                  </p>
                )}

                <div className="mt-4">
                  <Label htmlFor={addActionId} className="wuxia-dialog-label">
                    Add action
                  </Label>
                  <Select
                    value=""
                    onValueChange={(value) =>
                      addAction(value as FoundryAction["kind"])
                    }
                    disabled={actions.length >= MAX_FOUNDRY_ACTIONS}
                  >
                    <SelectTrigger
                      id={addActionId}
                      className="wuxia-dialog-control w-full"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <SelectValue placeholder="Choose action type" />
                      </span>
                    </SelectTrigger>
                    <SelectContent className="wuxia-select-content">
                      <SelectItem value="roll_damage">Damage roll</SelectItem>
                      <SelectItem value="roll_healing">Healing roll</SelectItem>
                      <SelectItem value="saving_throw">Saving throw</SelectItem>
                      <SelectItem value="roll_attack">Attack roll</SelectItem>
                    </SelectContent>
                  </Select>
                  {actions.length >= MAX_FOUNDRY_ACTIONS ? (
                    <p className="mt-2 text-xs leading-5 text-[var(--wuxia-dialog-muted)]">
                      This tier has reached the {MAX_FOUNDRY_ACTIONS}-action
                      limit.
                    </p>
                  ) : null}
                </div>
              </aside>

              <section
                id={editorPanelId}
                className="px-4 py-5 sm:px-6 sm:py-6 lg:min-h-0 lg:overflow-y-auto"
                aria-label="Selected Foundry action"
              >
                {selectedAction ? (
                  <>
                    <div className="mb-6 flex flex-wrap items-start justify-between gap-3 border-b border-[var(--wuxia-dialog-line)] pb-4">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--wuxia-dialog-line)] bg-[var(--wuxia-dialog-field)] dark:rounded-sm">
                          <FoundryActionIcon
                            kind={selectedAction.kind}
                            className="h-4 w-4"
                          />
                        </span>
                        <div className="min-w-0">
                          <p className="wuxia-dialog-kicker">
                            Action {selectedActionIndex + 1}
                          </p>
                          <h3 className="text-lg font-semibold text-[var(--wuxia-dialog-ink)]">
                            {actionTitle(selectedAction)}
                          </h3>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="wuxia-icon-action h-8 w-8"
                          onClick={() => moveAction(selectedActionIndex, -1)}
                          disabled={selectedActionIndex === 0}
                          aria-label={`Move ${actionTitle(selectedAction).toLowerCase()} ${selectedActionIndex + 1} up`}
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="wuxia-icon-action h-8 w-8"
                          onClick={() => moveAction(selectedActionIndex, 1)}
                          disabled={selectedActionIndex === actions.length - 1}
                          aria-label={`Move ${actionTitle(selectedAction).toLowerCase()} ${selectedActionIndex + 1} down`}
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="wuxia-icon-action wuxia-icon-danger h-8 w-8"
                          onClick={() => removeAction(selectedAction.id)}
                          aria-label={`Remove ${actionTitle(selectedAction).toLowerCase()} ${selectedActionIndex + 1}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {selectedActionError ? (
                      <p
                        id={errorId}
                        className="mb-5 flex items-center gap-2 border-l-2 border-destructive/60 bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive"
                        role="alert"
                      >
                        <CircleAlert
                          className="h-4 w-4 shrink-0"
                          aria-hidden="true"
                        />
                        {selectedActionError.message}
                      </p>
                    ) : null}

                    <div className="space-y-6">
                      <div>
                        <Label htmlFor={labelId} className="wuxia-dialog-label">
                          Label{" "}
                          <span className="normal-case tracking-normal">
                            (optional)
                          </span>
                        </Label>
                        <Input
                          id={labelId}
                          value={selectedAction.label ?? ""}
                          onChange={(event) =>
                            replaceAction(selectedAction.id, {
                              ...selectedAction,
                              label: event.target.value,
                            })
                          }
                          placeholder="e.g. Devour Essence"
                          maxLength={255}
                          className="wuxia-dialog-control"
                        />
                        <p className="mt-1 text-xs leading-5 text-[var(--wuxia-dialog-muted)]">
                          Replaces the default action name on the Foundry chat
                          card.
                        </p>
                      </div>

                      {selectedAction.kind === "roll_damage" ||
                      selectedAction.kind === "roll_healing" ? (
                        <section className="border-t border-[var(--wuxia-dialog-line)] pt-5">
                          <p className="wuxia-dialog-kicker mb-3">
                            Roll details
                          </p>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                              <Label
                                htmlFor={formulaId}
                                className="wuxia-dialog-label"
                              >
                                Formula
                              </Label>
                              <Input
                                id={formulaId}
                                value={selectedAction.formula}
                                onChange={(event) =>
                                  replaceAction(selectedAction.id, {
                                    ...selectedAction,
                                    formula: event.target.value,
                                  })
                                }
                                placeholder="2d8 + 4"
                                maxLength={200}
                                aria-required="true"
                                aria-invalid={
                                  hasErrorAt("formula") || undefined
                                }
                                aria-describedby={
                                  hasErrorAt("formula") ? errorId : undefined
                                }
                                className="wuxia-dialog-control font-mono"
                              />
                            </div>

                            {selectedAction.kind === "roll_damage" ? (
                              <div>
                                <Label
                                  htmlFor={damageTypeId}
                                  className="wuxia-dialog-label"
                                >
                                  Damage type
                                </Label>
                                <Select
                                  value={selectedAction.damageType}
                                  onValueChange={(damageType: DamageType) =>
                                    replaceAction(selectedAction.id, {
                                      ...selectedAction,
                                      damageType,
                                    })
                                  }
                                >
                                  <SelectTrigger
                                    id={damageTypeId}
                                    className="wuxia-dialog-control w-full"
                                  >
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="wuxia-select-content">
                                    {DAMAGE_TYPES.map((damageType) => (
                                      <SelectItem
                                        key={damageType}
                                        value={damageType}
                                      >
                                        {damageTypeLabel(damageType)}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            ) : null}
                          </div>
                        </section>
                      ) : null}

                      {selectedAction.kind === "roll_attack" ? (
                        <section className="border-t border-[var(--wuxia-dialog-line)] pt-5">
                          <p className="wuxia-dialog-kicker mb-2">
                            Attack roll
                          </p>
                          <p className="max-w-2xl text-sm leading-6 text-[var(--wuxia-dialog-muted)]">
                            Foundry rolls 1d20 using the character&apos;s
                            Spiritual Arts attack modifier. The modifier is
                            derived from their Spiritual Arts ability and
                            proficiency bonus.
                          </p>
                        </section>
                      ) : null}

                      {selectedAction.kind !== "roll_attack" ? (
                        <section className="border-t border-[var(--wuxia-dialog-line)] pt-5">
                          <p className="wuxia-dialog-kicker mb-3">
                            Save &amp; area
                          </p>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                              <Label
                                htmlFor={savingThrowId}
                                className="wuxia-dialog-label"
                              >
                                Saving throw{" "}
                                {selectedAction.kind !== "saving_throw" ? (
                                  <span className="normal-case tracking-normal">
                                    (optional)
                                  </span>
                                ) : null}
                              </Label>
                              <Select
                                value={
                                  selectedAction.savingThrow?.ability ?? "none"
                                }
                                onValueChange={(value) =>
                                  replaceAction(
                                    selectedAction.id,
                                    setSavingThrow(
                                      selectedAction,
                                      value === "none"
                                        ? undefined
                                        : (value as SavingThrowAbility),
                                    ),
                                  )
                                }
                              >
                                <SelectTrigger
                                  id={savingThrowId}
                                  aria-required={
                                    selectedAction.kind === "saving_throw" ||
                                    undefined
                                  }
                                  aria-invalid={
                                    hasErrorAt("savingThrow") || undefined
                                  }
                                  aria-describedby={
                                    hasErrorAt("savingThrow")
                                      ? errorId
                                      : undefined
                                  }
                                  className="wuxia-dialog-control w-full"
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="wuxia-select-content">
                                  {selectedAction.kind !== "saving_throw" ? (
                                    <SelectItem value="none">None</SelectItem>
                                  ) : null}
                                  {SAVING_THROW_ABILITIES.map((ability) => (
                                    <SelectItem key={ability} value={ability}>
                                      {SAVING_THROW_LABELS[ability]}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <p className="mt-1 text-xs leading-5 text-[var(--wuxia-dialog-muted)]">
                                Uses the character&apos;s Spiritual Arts DC in
                                Foundry.
                              </p>
                            </div>

                            <div>
                              <Label
                                htmlFor={templateTypeId}
                                className="wuxia-dialog-label"
                              >
                                Measured template{" "}
                                <span className="normal-case tracking-normal">
                                  (optional)
                                </span>
                              </Label>
                              <Select
                                value={selectedAction.template?.type ?? "none"}
                                onValueChange={(value) =>
                                  replaceAction(
                                    selectedAction.id,
                                    setMeasuredTemplate(
                                      selectedAction,
                                      value === "none"
                                        ? undefined
                                        : (value as FoundryMeasuredTemplate["type"]),
                                    ),
                                  )
                                }
                              >
                                <SelectTrigger
                                  id={templateTypeId}
                                  aria-invalid={
                                    hasErrorAt("template", "type") || undefined
                                  }
                                  aria-describedby={
                                    hasErrorAt("template", "type")
                                      ? errorId
                                      : undefined
                                  }
                                  className="wuxia-dialog-control w-full"
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="wuxia-select-content">
                                  <SelectItem value="none">None</SelectItem>
                                  {FOUNDRY_TEMPLATE_TYPES.map((type) => (
                                    <SelectItem key={type} value={type}>
                                      {TEMPLATE_TYPE_LABELS[type]}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {selectedAction.template ? (
                              <>
                                <div>
                                  <Label
                                    htmlFor={templateDistanceId}
                                    className="wuxia-dialog-label"
                                  >
                                    {templateDistanceLabel(
                                      selectedAction.template.type,
                                    )}
                                  </Label>
                                  <Input
                                    id={templateDistanceId}
                                    type="number"
                                    min={1}
                                    max={MAX_FOUNDRY_TEMPLATE_DISTANCE}
                                    step="any"
                                    value={
                                      selectedAction.template.distance || ""
                                    }
                                    aria-invalid={
                                      hasErrorAt("template", "distance") ||
                                      undefined
                                    }
                                    aria-describedby={
                                      hasErrorAt("template", "distance")
                                        ? errorId
                                        : undefined
                                    }
                                    onChange={(event) =>
                                      replaceAction(
                                        selectedAction.id,
                                        setTemplateDistance(
                                          selectedAction,
                                          Number(event.target.value),
                                        ),
                                      )
                                    }
                                    className="wuxia-dialog-control"
                                  />
                                </div>

                                {selectedAction.template.type === "cone" ? (
                                  <div>
                                    <Label
                                      htmlFor={templateAngleId}
                                      className="wuxia-dialog-label"
                                    >
                                      Angle (degrees)
                                    </Label>
                                    <Input
                                      id={templateAngleId}
                                      type="number"
                                      min={1}
                                      max={MAX_FOUNDRY_TEMPLATE_ANGLE}
                                      step="any"
                                      value={
                                        selectedAction.template.angle || ""
                                      }
                                      aria-invalid={
                                        hasErrorAt("template", "angle") ||
                                        undefined
                                      }
                                      aria-describedby={
                                        hasErrorAt("template", "angle")
                                          ? errorId
                                          : undefined
                                      }
                                      onChange={(event) =>
                                        replaceAction(
                                          selectedAction.id,
                                          setConeAngle(
                                            selectedAction,
                                            Number(event.target.value),
                                          ),
                                        )
                                      }
                                      className="wuxia-dialog-control"
                                    />
                                  </div>
                                ) : null}

                                {selectedAction.template.type === "ray" ? (
                                  <div>
                                    <Label
                                      htmlFor={templateWidthId}
                                      className="wuxia-dialog-label"
                                    >
                                      Width (feet)
                                    </Label>
                                    <Input
                                      id={templateWidthId}
                                      type="number"
                                      min={1}
                                      max={MAX_FOUNDRY_TEMPLATE_DISTANCE}
                                      step="any"
                                      value={
                                        selectedAction.template.width || ""
                                      }
                                      aria-invalid={
                                        hasErrorAt("template", "width") ||
                                        undefined
                                      }
                                      aria-describedby={
                                        hasErrorAt("template", "width")
                                          ? errorId
                                          : undefined
                                      }
                                      onChange={(event) =>
                                        replaceAction(
                                          selectedAction.id,
                                          setRayWidth(
                                            selectedAction,
                                            Number(event.target.value),
                                          ),
                                        )
                                      }
                                      className="wuxia-dialog-control"
                                    />
                                  </div>
                                ) : null}
                              </>
                            ) : null}
                          </div>
                        </section>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <div className="flex min-h-[18rem] flex-col items-center justify-center text-center">
                    <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-[var(--wuxia-dialog-line)] bg-[var(--wuxia-dialog-field)] dark:rounded-sm">
                      <Plus className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <h3 className="text-lg font-semibold text-[var(--wuxia-dialog-ink)]">
                      No Foundry actions yet
                    </h3>
                    <p className="mt-2 max-w-sm text-sm leading-6 text-[var(--wuxia-dialog-muted)]">
                      Use the Add action menu to choose a damage, healing,
                      saving throw, or attack roll.
                    </p>
                  </div>
                )}
              </section>
            </div>
          </CampaignDialogBody>
        )}

        <CampaignDialogFooter className="sm:justify-between">
          <p className="text-xs leading-5 text-[var(--wuxia-dialog-muted)]">
            These changes are included when you save the technique.
          </p>
          <Button
            type="button"
            className="wuxia-primary-action w-full sm:w-auto"
            onClick={() => setIsOpen(false)}
          >
            Done
          </Button>
        </CampaignDialogFooter>
      </CampaignDialogContent>
    </Dialog>
  );
}
