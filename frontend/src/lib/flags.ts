import type { FlagLevel } from "./api";

export const FLAG_META: Record<
  FlagLevel,
  { label: string; sub: string; color: string; chip: string; ring: string; dot: string }
> = {
  green: {
    label: "Green Flags",
    sub: "Aligned with UoA Position",
    color: "text-flag-green",
    chip: "bg-flag-green/10 text-flag-green border border-flag-green/20",
    ring: "ring-flag-green/30",
    dot: "bg-flag-green",
  },
  amber: {
    label: "Amber Flags",
    sub: "Requires Contract Manager Review",
    color: "text-flag-amber",
    chip: "bg-flag-amber/10 text-flag-amber border border-flag-amber/20",
    ring: "ring-flag-amber/30",
    dot: "bg-flag-amber",
  },
  red: {
    label: "Red Flags",
    sub: "Conflicts with UoA Position",
    color: "text-flag-red",
    chip: "bg-flag-red/10 text-flag-red border border-flag-red/20",
    ring: "ring-flag-red/30",
    dot: "bg-flag-red",
  },
  blue: {
    label: "Blue Flags",
    sub: "Not Covered in UoA Position",
    color: "text-flag-blue",
    chip: "bg-flag-blue/10 text-flag-blue border border-flag-blue/20",
    ring: "ring-flag-blue/30",
    dot: "bg-flag-blue",
  },
};

export const FLAG_ORDER: FlagLevel[] = ["red", "amber", "blue", "green"];
