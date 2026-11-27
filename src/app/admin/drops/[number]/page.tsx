import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import AdminForm from "@/components/AdminForm";
import styles from "@/components/admin.module.css";
import { addEditionAction, closeDropAction, scheduleDropAction, updateDropAction, updateEditionAction } from "@/lib/admin-actions";
import { allVariants, findDrop } from "@/lib/admin-drops";
import { getDrop, parseDropNumber } from "@/lib/catalogue";
import { salesStarted, toVietnamInput } from "@/lib/drop-admin-rules";
import { formatDateTime, formatVnd, unitNumber } from "@/lib/format";
import { requireStaff } from "@/lib/staff-session";

export const dynamic = "force-dynamic";

/** A3 (one drop) and A4, the edition editor. */
export default async function Drop({ params, searchParams }: PageProps<"/admin/drops/[number]">) {
  await requireStaff("drops");
  const number = parseDropNumber((await params).number);
  const drop = number === null ? null : await findDrop(number);
  if (!drop) notFound();
  const { saved } = await searchParams;
  const t = await getTranslations("admin");
  const d = await getTranslations("drop");
  const live = await getDrop(drop.number);
  const locked = salesStarted(drop, new Date());
  const hidden = { number: String(drop.number) };
  const spare = (await allVariants()).filter((v) => !drop.editions.some((row) => row.variantId === v.id));
  const terms = (row?: { size: number; priceVnd: number; perPersonCap: number }) => [
    { name: "size", label: t("size"), type: "number" as const, value: row ? String(row.size) : "" },
    { name: "priceVnd", label: t("priceVnd"), type: "number" as const, value: row ? String(row.priceVnd) : "" },
    { name: "perPersonCap", label: t("cap"), type: "number" as const, value: String(row?.perPersonCap ?? 1) },
  ];
  const time = (date: Date | null) => (date ? formatDateTime(date.toISOString()) : "—");

  return (
    <>
      <nav><Link href="/admin/drops">{t("allDrops")}</Link></nav>
      <h1>{drop.name} <span className={styles.chip}>{live ? d(`state.${live.state}`) : t("draft")}</span></h1>
      {saved === "1" && <p role="status">{t("saved")}</p>}
      {locked && <p className={styles.note}>{t("lockedNote")}</p>}
      <p>{t("vietnamTime")}</p>

      {locked ? (
        <dl className={styles.facts}>
          <dt>{t("earlyAccessAt")}</dt><dd>{time(drop.earlyAccessAt)}</dd>
          <dt>{t("publicAt")}</dt><dd>{time(drop.publicAt)}</dd>
          <dt>{t("closeAt")}</dt><dd>{time(drop.closeAt)}</dd>
        </dl>
      ) : (
        <AdminForm
          // keyed by what's stored, so a save refills the fields
          key={`${drop.name}-${time(drop.earlyAccessAt)}-${time(drop.publicAt)}-${time(drop.closeAt)}`}
          action={updateDropAction} hidden={hidden} submit={t("save")} label={t("details")}
          fields={[
            { name: "name", label: t("name"), value: drop.name },
            { name: "earlyAccessAt", label: t("earlyAccessAt"), type: "datetime-local", value: toVietnamInput(drop.earlyAccessAt) },
            { name: "publicAt", label: t("publicAt"), type: "datetime-local", value: toVietnamInput(drop.publicAt) },
            { name: "closeAt", label: t("closeAt"), type: "datetime-local", value: toVietnamInput(drop.closeAt) },
          ]}
        />
      )}

      <h2>{t("editions")}</h2>
      {drop.editions.length === 0 && <p>{t("noEditions")}</p>}
      {drop.editions.map((row) => (
        <section key={row.id} className={styles.edition}>
          <h3>{row.name} · {row.colour}</h3>
          <p>No. 001–{unitNumber(row.size)} · {formatVnd(row.priceVnd)} · {t("capIs", { cap: row.perPersonCap })} · {t("taken", { taken: row.taken })}</p>
          {!locked && (
            <AdminForm
              key={`${row.size}-${row.priceVnd}-${row.perPersonCap}`}
              action={updateEditionAction} hidden={{ ...hidden, edition: row.id }} submit={t("save")}
              label={`${row.name} ${row.colour}`} fields={terms(row)}
            />
          )}
        </section>
      ))}

      {!locked && spare.length > 0 && (
        <>
          <h2>{t("addEdition")}</h2>
          <AdminForm
            key={spare.map((v) => v.id).join()} action={addEditionAction} hidden={hidden} submit={t("add")} label={t("addEdition")}
            fields={[
              { name: "variant", label: t("variant"), value: spare[0].id, options: spare.map((v) => ({ value: v.id, label: `${v.name} · ${v.colour} (${formatVnd(v.listPriceVnd)})` })) },
              ...terms(),
            ]}
          />
        </>
      )}

      {drop.state !== "draft" && drop.state !== "closed" && (
        // opening this is the confirm step
        <details>
          <summary className={styles.summary}>{t("closeDrop")}</summary>
          <p>{t("closeNote")}</p>
          <AdminForm action={closeDropAction} hidden={hidden} submit={t("closeConfirm")} label={t("closeDrop")} />
        </details>
      )}

      {drop.state === "draft" && (
        <>
          <h2>{t("schedule")}</h2>
          <p>{t("scheduleNote")}</p>
          <AdminForm action={scheduleDropAction} hidden={hidden} submit={t("schedule")} label={t("schedule")} />
        </>
      )}
    </>
  );
}
