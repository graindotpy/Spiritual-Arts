export function getProficiencyBonusForLevel(level: number): number {
  return 2 + Math.floor((level - 1) / 4);
}

export function calculateSpiritualArtsDc(
  level: number,
  highestAbilityScore: number | null | undefined,
): number | null {
  const attackModifier = calculateSpiritualArtsAttackModifier(
    level,
    highestAbilityScore,
  );
  return attackModifier === null ? null : 8 + attackModifier;
}

export function calculateSpiritualArtsAttackModifier(
  level: number,
  highestAbilityScore: number | null | undefined,
): number | null {
  if (
    !Number.isInteger(level) ||
    level < 1 ||
    level > 20 ||
    highestAbilityScore == null ||
    !Number.isInteger(highestAbilityScore) ||
    highestAbilityScore < 1 ||
    highestAbilityScore > 30
  ) {
    return null;
  }

  const abilityModifier = Math.floor((highestAbilityScore - 10) / 2);
  return getProficiencyBonusForLevel(level) + abilityModifier;
}
