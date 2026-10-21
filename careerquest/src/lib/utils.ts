import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function sum(nums: number[]) {
  return nums.reduce((a, b) => a + b, 0);
}

export function assertNever(x: never): never {
  throw new Error(`Unexpected value: ${String(x)}`);
}
