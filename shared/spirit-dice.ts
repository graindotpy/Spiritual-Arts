import { z } from "zod";

export const DIE_SIZES = ["d4", "d6", "d8", "d10", "d12"] as const;

export const dieSizeSchema = z.enum(DIE_SIZES);
export type DieSize = z.infer<typeof dieSizeSchema>;

/**
 * A pool keeps stable slots. A depleted die is represented by `null` rather
 * than removing it from the array, so the remaining dice never shift places.
 */
export type SpiritDieSlot = DieSize | null;
export const spiritDieSlotSchema = dieSizeSchema.nullable();
export const spiritDieSlotsSchema = z.array(spiritDieSlotSchema).max(20);

export const SPIRIT_DIE_PROGRESSION: Readonly<
  Record<number, readonly DieSize[]>
> = {
  1: ["d4"],
  2: ["d4"],
  3: ["d4", "d4"],
  4: ["d4", "d4"],
  5: ["d4", "d4"],
  6: ["d4", "d6"],
  7: ["d4", "d6"],
  8: ["d6", "d6"],
  9: ["d6", "d6"],
  10: ["d6", "d8"],
  11: ["d6", "d8"],
  12: ["d8", "d8"],
  13: ["d8", "d8"],
  14: ["d8", "d10"],
  15: ["d8", "d10"],
  16: ["d10", "d10"],
  17: ["d10", "d10"],
  18: ["d10", "d12"],
  19: ["d10", "d12"],
  20: ["d12", "d12"],
};

export const MIN_CHARACTER_LEVEL = 1;
export const MAX_CHARACTER_LEVEL = 20;

export function getSpiritDiceForLevel(level: number): DieSize[] {
  const normalizedLevel = Math.min(
    MAX_CHARACTER_LEVEL,
    Math.max(MIN_CHARACTER_LEVEL, Math.trunc(level)),
  );

  return [...SPIRIT_DIE_PROGRESSION[normalizedLevel]];
}

export function isDieSize(value: unknown): value is DieSize {
  return dieSizeSchema.safeParse(value).success;
}

/**
 * Normalizes legacy pools that removed depleted dice. Missing trailing slots
 * are treated as depleted; new writes retain nulls and therefore stay stable.
 */
export function normalizeSpiritDieSlots(
  value: unknown,
  slotCount?: number,
): SpiritDieSlot[] {
  const parsed = spiritDieSlotsSchema.safeParse(value);
  const slots = parsed.success ? [...parsed.data] : [];

  if (slotCount === undefined) {
    return slots;
  }

  return Array.from({ length: slotCount }, (_, index) => slots[index] ?? null);
}

export function getDieMaximum(die: DieSize): number {
  return Number(die.slice(1));
}

export function canSpiritDieMeetInvestment(
  die: SpiritDieSlot,
  spInvestment: number,
): boolean {
  return (
    die !== null &&
    Number.isInteger(spInvestment) &&
    spInvestment > 0 &&
    spInvestment <= getDieMaximum(die)
  );
}

export function reduceDie(die: DieSize): SpiritDieSlot {
  const index = DIE_SIZES.indexOf(die);
  return index > 0 ? DIE_SIZES[index - 1] : null;
}

export function restoreDie(die: SpiritDieSlot, maximum: DieSize): DieSize {
  if (die === null) {
    return DIE_SIZES[0];
  }

  const currentIndex = DIE_SIZES.indexOf(die);
  const maximumIndex = DIE_SIZES.indexOf(maximum);
  return DIE_SIZES[Math.min(currentIndex + 1, maximumIndex)];
}

export function restoreSpiritDieSlot(
  currentDice: readonly SpiritDieSlot[],
  maximumDice: readonly DieSize[],
  dieIndex: number,
): SpiritDieSlot[] {
  if (!Number.isInteger(dieIndex) || dieIndex < 0 || dieIndex >= maximumDice.length) {
    return [...currentDice];
  }

  const normalized = normalizeSpiritDieSlots(currentDice, maximumDice.length);
  normalized[dieIndex] = restoreDie(normalized[dieIndex], maximumDice[dieIndex]);
  return normalized;
}

export interface SpiritDieRoll {
  value: number;
  success: boolean;
  dieRolled: DieSize;
  newDicePool: SpiritDieSlot[];
}

export interface RollSpiritDieInput {
  currentDice: readonly SpiritDieSlot[];
  dieIndex: number;
  spInvestment: number;
  random?: () => number;
}

export function rollSpiritDie({
  currentDice,
  dieIndex,
  spInvestment,
  random = Math.random,
}: RollSpiritDieInput): SpiritDieRoll {
  if (!Number.isInteger(spInvestment) || spInvestment < 1) {
    throw new RangeError("SP investment must be a positive integer");
  }

  if (!Number.isInteger(dieIndex) || dieIndex < 0 || dieIndex >= currentDice.length) {
    throw new RangeError("Die index is outside the pool");
  }

  const die = currentDice[dieIndex];
  if (!die) {
    throw new RangeError("The selected die is depleted");
  }
  if (!canSpiritDieMeetInvestment(die, spInvestment)) {
    throw new RangeError(
      `${die.toUpperCase()} cannot power a ${spInvestment} SP technique`,
    );
  }

  const value = Math.floor(random() * getDieMaximum(die)) + 1;
  const success = value >= spInvestment;
  const newDicePool = [...currentDice];

  if (!success) {
    newDicePool[dieIndex] = reduceDie(die);
  }

  return { value, success, dieRolled: die, newDicePool };
}
