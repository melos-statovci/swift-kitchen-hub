import { z } from "zod";

export function createMenuFormSchema(currency: string) {
  const fields = {
    name: z.string().trim().min(1, "Name is required").max(120),
    description: z.string().trim().max(1000).optional(),
    category: z.string().min(1, "Select a category"),
    imageUrl: z.string().trim().url("Enter a valid image URL").or(z.literal("")).optional(),
    available: z.boolean(),
  };
  const flatPrice = z.coerce
    .number({ invalid_type_error: "Enter a price" })
    .min(0, "Price can't be negative")
    .max(1000, `Price can't exceed 1,000 ${currency}`);
  return z.discriminatedUnion("variantMode", [
    z.object({ ...fields, variantMode: z.literal("NONE"), price: flatPrice }),
    // Required variants have their own prices. The unused flat draft must not
    // block their save, even after a manager enters an invalid flat amount.
    z.object({
      ...fields,
      variantMode: z.literal("REQUIRED"),
      price: z.union([z.number(), z.string(), z.null()]).optional(),
    }),
  ]);
}

export function validateRequiredVariants(
  variants: ReadonlyArray<{ name: string; priceEuros: number }>,
): string | null {
  if (variants.length === 0) return "Add at least one variant.";
  if (
    variants.some(
      (variant) =>
        !variant.name.trim() ||
        !Number.isFinite(variant.priceEuros) ||
        variant.priceEuros < 0 ||
        variant.priceEuros > 1000,
    )
  ) {
    return "Every variant needs a name and a valid price.";
  }
  return null;
}
