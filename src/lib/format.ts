// NFR-024/025: VND with VAT included, dd/MM/yyyy, Vietnam time. vi-VN here is the money format, not a language.
const vnd = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });
const dateTime = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  hourCycle: "h23", timeZone: "Asia/Ho_Chi_Minh",
});

export const formatVnd = (amount: number) => vnd.format(amount);
export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));
export const unitNumber = (n: number) => String(n).padStart(3, "0");
