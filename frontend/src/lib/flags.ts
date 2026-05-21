import type { FlagLevel } from "./api";

export const FLAG_META: Record<
  FlagLevel,
  { label: string; sub: string; color: string; chip: string; ring: string; dot: string }
> = {
  green: {
    label: "Green Flags",
    sub: "Aligned with UoA Position",
    color: "text-flag-green",
    chip: "bg-white text-flag-green border border-ink-200",
    ring: "ring-ink-200",
    dot: "bg-flag-green",
  },
  amber: {
    label: "Amber Flags",
    sub: "Requires Contract Manager Review",
    color: "text-flag-amber",
    chip: "bg-white text-flag-amber border border-ink-200",
    ring: "ring-ink-200",
    dot: "bg-flag-amber",
  },
  red: {
    label: "Red Flags",
    sub: "Conflicts with UoA Position",
    color: "text-flag-red",
    chip: "bg-white text-flag-red border border-ink-200",
    ring: "ring-ink-200",
    dot: "bg-flag-red",
  },
  blue: {
    label: "Blue Flags",
    sub: "Not Covered in UoA Position",
    color: "text-flag-blue",
    chip: "bg-white text-flag-blue border border-ink-200",
    ring: "ring-ink-200",
    dot: "bg-flag-blue",
  },
};

export const FLAG_ORDER: FlagLevel[] = ["red", "amber", "blue", "green"];
