import { KZT_MINOR_UNIT_EXPONENT, type MinorUnits } from "@/types/api";

/** Conversion to decimal KZT is for display only; API requests keep minor units. */
export function formatKZT(
  amountMinor: MinorUnits,
  locale = "ru-KZ",
  exponent = KZT_MINOR_UNIT_EXPONENT,
): string {
  if (!Number.isSafeInteger(amountMinor)) {
    throw new RangeError("KZT amount must be a safe integer in minor units.");
  }
  if (!Number.isInteger(exponent) || exponent < 0 || exponent > 6) {
    throw new RangeError(
      "Currency exponent must be an integer between 0 and 6.",
    );
  }
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "KZT",
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
  }).format(amountMinor / 10 ** exponent);
}
