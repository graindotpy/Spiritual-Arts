import {
  FOUNDRY_MECHANICS_VERSION,
  foundryMechanicsSchema,
  type FoundryAction,
  type FoundryMeasuredTemplate,
  type FoundryMechanics,
} from "@shared/mechanics";

export interface StoredMechanicsDraft {
  mechanics?: FoundryMechanics;
  error?: string;
}

function createUuid(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex
    .slice(6, 8)
    .join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
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
        normalized.kind === "roll_attack"
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
