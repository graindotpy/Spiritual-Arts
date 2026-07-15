import {
  FOUNDRY_MECHANICS_VERSION,
  foundryMechanicsSchema,
  type FoundryAction,
  type FoundryMeasuredTemplate,
  type FoundryMechanics,
} from "@shared/mechanics";
import { createUuid } from "@/lib/uuid";

export interface StoredMechanicsDraft {
  mechanics?: FoundryMechanics;
  error?: string;
}

export function createFoundryAction(
  kind: FoundryAction["kind"],
  id: string = createUuid(),
): FoundryAction {
  switch (kind) {
    case "roll_damage":
      return { id, kind, formula: "1d6", damageType: "force" };
    case "roll_healing":
      return { id, kind, formula: "1d6" };
    case "saving_throw":
      return { id, kind, savingThrow: { ability: "dex" } };
    case "roll_attack":
      return { id, kind };
    case "place_template":
      return { id, kind, template: { type: "circle", distance: 5 } };
  }
}

function cloneFoundryTemplate(
  template: FoundryMeasuredTemplate,
): FoundryMeasuredTemplate {
  switch (template.type) {
    case "circle":
    case "rectangle":
      return { type: template.type, distance: template.distance };
    case "cone":
      return {
        type: template.type,
        distance: template.distance,
        angle: template.angle,
      };
    case "ray":
      return {
        type: template.type,
        distance: template.distance,
        width: template.width,
      };
  }
}

function cloneFoundryAction(action: FoundryAction): FoundryAction {
  if (action.kind === "roll_attack") {
    return { ...action };
  }

  if (action.kind === "place_template") {
    return { ...action, template: cloneFoundryTemplate(action.template) };
  }

  const { savingThrow, template, ...base } = action;
  return {
    ...base,
    ...(savingThrow ? { savingThrow: { ability: savingThrow.ability } } : {}),
    ...(template ? { template: cloneFoundryTemplate(template) } : {}),
  } as FoundryAction;
}

export function cloneFoundryMechanicsWithNewActionIds(
  mechanics: FoundryMechanics,
  createId: () => string = createUuid,
): FoundryMechanics {
  return {
    ...mechanics,
    actions: mechanics.actions.map((action) => ({
      ...cloneFoundryAction(action),
      id: createId(),
    })),
  };
}

export function parseStoredFoundryMechanics(
  value: unknown,
): StoredMechanicsDraft {
  if (value === undefined) return {};
  const parsed = foundryMechanicsSchema.safeParse(value);
  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ??
        "The stored Foundry mechanics use an unsupported format.",
    };
  }

  return {
    mechanics: {
      ...parsed.data,
      actions: parsed.data.actions.map(cloneFoundryAction),
    },
  };
}

export function normalizeFoundryMechanics(
  mechanics: FoundryMechanics | undefined,
): FoundryMechanics | undefined {
  if (!mechanics || mechanics.actions.length === 0) return undefined;
  return {
    version: FOUNDRY_MECHANICS_VERSION,
    actions: mechanics.actions.map((action) => {
      const normalized = cloneFoundryAction(action);
      if (
        normalized.kind === "saving_throw" ||
        normalized.kind === "roll_attack" ||
        normalized.kind === "place_template"
      ) {
        return {
          ...normalized,
          label: normalized.label?.trim() || undefined,
        };
      }
      return {
        ...normalized,
        formula: normalized.formula.trim(),
        label: normalized.label?.trim() || undefined,
      };
    }),
  };
}

export function hasFoundryActionsWithoutEffect(
  effectText: string,
  mechanics: FoundryMechanics | undefined,
): boolean {
  return effectText.trim().length === 0 && (mechanics?.actions.length ?? 0) > 0;
}

export function moveFoundryAction(
  actions: readonly FoundryAction[],
  index: number,
  offset: -1 | 1,
): FoundryAction[] {
  const reordered = [...actions];
  const destination = index + offset;
  if (
    index < 0 ||
    index >= actions.length ||
    destination < 0 ||
    destination >= actions.length
  ) {
    return reordered;
  }
  [reordered[index], reordered[destination]] = [
    reordered[destination],
    reordered[index],
  ];
  return reordered;
}
