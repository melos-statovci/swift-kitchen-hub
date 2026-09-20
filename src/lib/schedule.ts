const HH_MM_24H = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function isValidHoursPair(open: string, close: string): boolean {
  return HH_MM_24H.test(open) && HH_MM_24H.test(close) && open !== close;
}
