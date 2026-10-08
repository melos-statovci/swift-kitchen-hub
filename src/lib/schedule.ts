const HH_MM_24H = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function isValidHoursPair(open: string, close: string): boolean {
  return HH_MM_24H.test(open) && HH_MM_24H.test(close) && open !== close;
}

// 00:00 → early morning is valid but usually meant "open until 02:00 tonight".
export function isLikelyMissedOvernight(open: string, close: string): boolean {
  return isValidHoursPair(open, close) && open === "00:00" && close <= "06:00";
}
