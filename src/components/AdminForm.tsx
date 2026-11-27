"use client";

import { useActionState, useId } from "react";
import { useTranslations } from "next-intl";
import type { AdminState } from "@/lib/admin-actions";
import styles from "./admin.module.css";

export type AdminField = {
  name: string; label: string; value?: string; type?: "text" | "number" | "datetime-local";
  options?: { value: string; label: string }[];
};

type Props = {
  action: (state: AdminState, form: FormData) => Promise<AdminState>;
  fields?: AdminField[];
  hidden: Record<string, string>;
  submit: string;
  /** What the group of fields is for, read out to screen readers. */
  label: string;
};

/** Every staff edit form: labelled fields, one inline error, and what was typed kept after it. */
export default function AdminForm({ action, fields = [], hidden, submit, label }: Props) {
  const t = useTranslations("admin");
  const [state, run, pending] = useActionState<AdminState, FormData>(action, {});
  const errorId = useId();
  return (
    <form action={run} className={styles.filters} aria-label={label} noValidate>
      {Object.entries(hidden).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
      {fields.map((field) => {
        const value = state.values?.[field.name] ?? field.value ?? "";
        return (
          <label key={field.name}>
            <span>{field.label}</span>
            {field.options ? (
              <select name={field.name} defaultValue={value} aria-describedby={errorId}>
                {field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            ) : (
              <input name={field.name} type={field.type ?? "text"} defaultValue={value} aria-describedby={errorId} />
            )}
          </label>
        );
      })}
      <button type="submit" disabled={pending}>{submit}</button>
      <p id={errorId} role="alert" className={styles.error}>{state.error ? t(`dropError.${state.error}`) : ""}</p>
    </form>
  );
}
