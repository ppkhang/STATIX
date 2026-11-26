import { defineRouting } from "next-intl/routing";

// Vietnamese is the default and has no prefix; English lives under /en (FR-091).
export const routing = defineRouting({
  locales: ["vi", "en"],
  defaultLocale: "vi",
  localePrefix: "as-needed",
});
