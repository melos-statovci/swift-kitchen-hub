export type VariantMode = "NONE" | "REQUIRED";

export function requiresExplicitFlatPrice(
  previousMode: VariantMode,
  nextMode: VariantMode,
): boolean {
  return previousMode === "REQUIRED" && nextMode === "NONE";
}
