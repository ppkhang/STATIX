import { getRequestConfig } from "next-intl/server";

// English only. The page text stays in one message file.
export default getRequestConfig(async () => ({
  locale: "en",
  timeZone: "Asia/Ho_Chi_Minh", // NFR-024: times in Vietnam time
  messages: (await import("../../messages/en.json")).default,
}));
