import type { Technique } from "./schema";

export interface TechniqueNameParts {
  baseName: string;
  variantName: string | null;
}

export interface TechniqueFamily {
  key: string;
  baseName: string;
  techniques: Technique[];
}

export function splitTechniqueName(name: string): TechniqueNameParts {
  const separator = name.indexOf(":");
  if (separator < 0) return { baseName: name.trim(), variantName: null };

  const baseName = name.slice(0, separator).trim();
  const variantName = name.slice(separator + 1).trim();
  if (!baseName || !variantName) return { baseName: name.trim(), variantName: null };
  return { baseName, variantName };
}

export function techniqueFamilyKey(name: string): string {
  return splitTechniqueName(name).baseName.toLocaleLowerCase();
}

export function getTechniqueVariantLabel(technique: Technique): string {
  return splitTechniqueName(technique.name).variantName ?? "Original";
}

export function groupTechniqueFamilies(techniques: Technique[]): TechniqueFamily[] {
  const families = new Map<string, TechniqueFamily>();

  for (const technique of techniques) {
    const { baseName } = splitTechniqueName(technique.name);
    const key = techniqueFamilyKey(technique.name);
    const family = families.get(key);
    if (family) {
      family.techniques.push(technique);
    } else {
      families.set(key, { key, baseName, techniques: [technique] });
    }
  }

  return Array.from(families.values());
}
