import { MOVEMENT_LABELS, type MovementType } from "./mock-store";

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  year: "numeric",
};

export function formatDate(value: string | number | Date): string {
  const parts = new Intl.DateTimeFormat("en-PH", DATE_OPTIONS).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("day")} ${part("month")} ${part("year")}`;
}

export function formatDateTime(value: string | number | Date): string {
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("en-PH", {
    ...DATE_OPTIONS,
    hour: "numeric",
    minute: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? "";
  const dayPeriod = part("dayPeriod");
  return `${formatDate(date)}, ${part("hour")}:${part("minute")}${dayPeriod ? ` ${dayPeriod}` : ""}`;
}

export function formatRelative(value: string | Date): string {
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (elapsedSeconds < 60) return "just now";

  const minutes = Math.floor(elapsedSeconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return `${Math.floor(days / 7)}w ago`;
}

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function humanizeMovement(type: MovementType): string {
  return MOVEMENT_LABELS[type];
}
