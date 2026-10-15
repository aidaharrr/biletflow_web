import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const merge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["badge", "label", "button", "title", "logo"],
      font: ["brand"],
      spacing: ["xs", "sm", "md", "lg", "xl", "button"],
      radius: ["button", "card", "input", "badge"],
      shadow: ["card"],
    },
    classGroups: { opacity: [{ opacity: ["disabled"] }] },
  },
});

export function cn(...values: ClassValue[]) {
  return merge(clsx(values));
}
