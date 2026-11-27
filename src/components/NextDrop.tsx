"use client";

import { useTranslations } from "next-intl";
import type { DropSnapshot } from "@/lib/catalogue";
import Countdown from "./Countdown";
import { useLiveDrop } from "./useLiveDrop";

/** Page 13: the countdown to the drop's next change, kept honest by the server clock. */
export default function NextDrop({ initial }: { initial: DropSnapshot }) {
  const t = useTranslations("drop");
  const { drop, now, stale } = useLiveDrop(initial);
  const { state, nextAt } = drop;
  return (
    <>
      <p>{t(`state.${state}`)}</p>
      {nextAt && (state === "scheduled" || state === "early_access" || state === "public") && (
        <>
          <p>{t(`until.${state}`)}</p>
          <Countdown to={nextAt} now={now} label={t("countdown")} />
        </>
      )}
      {stale && <p role="status">{t("stale")}</p>}
    </>
  );
}
