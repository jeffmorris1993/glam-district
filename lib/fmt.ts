export const n = (v: number) => Math.round(v).toLocaleString("en-US");

export const money = (v: number, dp = 0) =>
  v.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  });

export const compactMoney = (v: number) => {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1)}M`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(v >= 100_000 ? 0 : 1)}K`;
  return money(v);
};

export const compact = (v: number) => {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 10_000) return `${(v / 1_000).toFixed(0)}K`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return n(v);
};

export const pct = (v: number, dp = 0) => `${(v * 100).toFixed(dp)}%`;

export const days = (v: number) => `${v.toFixed(1)} ${v >= 0.95 && v < 1.05 ? "day" : "days"}`;

export const plural = (v: number, one: string, many = `${one}s`) => (v === 1 ? one : many);

export const signed = (v: number) => (v > 0 ? `+${n(v)}` : n(v));
