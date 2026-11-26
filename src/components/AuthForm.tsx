"use client";

import { Fragment, useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import type { FormState } from "@/lib/auth-actions";
import { PASSWORD_MIN } from "@/lib/auth-rules";
import styles from "./auth.module.css";

export type Field = "email" | "password" | "newPassword" | "phone" | "code";

const INPUT: Record<Field, React.InputHTMLAttributes<HTMLInputElement>> = {
  email: { name: "email", type: "email", autoComplete: "email" },
  password: { name: "password", type: "password", autoComplete: "current-password" },
  newPassword: { name: "password", type: "password", autoComplete: "new-password" },
  phone: { name: "phone", type: "tel", autoComplete: "tel" },
  code: { name: "code", type: "text", autoComplete: "one-time-code", inputMode: "numeric", maxLength: 6 },
};

type Props = {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  fields: Field[];
  submit: string;
  hidden?: Record<string, string>;
  /** Filled into the email field to begin with. */
  email?: string;
  /** A small line under the password field, in the spot where the password rule sits. */
  passwordHelp?: React.ReactNode;
};

/** Every account form: labelled fields, one inline error, and the password rule shown while typing. */
export default function AuthForm({ action, fields, submit, hidden, passwordHelp, email }: Props) {
  const t = useTranslations("auth");
  const [state, run, pending] = useActionState(action, {});
  const [length, setLength] = useState(0);

  if (state.sent) return <p role="status" className={styles.notice}>{t(state.sent)}</p>;

  return (
    <form action={run} className={styles.form} noValidate>
      {Object.entries(hidden ?? {}).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
      {fields.map((name) => (
        <Fragment key={name}>
          <label>
            <span>{t(`field.${name}`)}</span>
            <input
              {...INPUT[name]}
              required
              defaultValue={name === "email" ? (state.email ?? email) : undefined}
              aria-describedby={name === "newPassword" ? "password-rule" : undefined}
              onChange={name === "newPassword" ? (event) => setLength([...event.target.value].length) : undefined}
            />
            {name === "newPassword" && (
              <small id="password-rule">
                {t("passwordRule", { min: PASSWORD_MIN })} {length >= PASSWORD_MIN ? "✓" : `${length}/${PASSWORD_MIN}`}
              </small>
            )}
          </label>
          {name === "password" && passwordHelp && <small className={styles.help}>{passwordHelp}</small>}
        </Fragment>
      ))}
      <p role="alert" className={styles.error}>{state.error ? t(`error.${state.error}`) : ""}</p>
      <button type="submit" disabled={pending}>{submit}</button>
    </form>
  );
}
