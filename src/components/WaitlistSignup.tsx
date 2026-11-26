"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import styles from "./signup.module.css";

type Problem = "empty" | "invalid" | null;

/**
 * The button, and the signup panel it opens over the page you're on, so nobody is sent away to sign up.
 * A native modal <dialog>: Escape closes it, focus stays inside it, and then goes back to the button.
 */
export default function WaitlistSignup({ label, buttonClass, minutes }: { label: string; buttonClass: string; minutes: number }) {
  const t = useTranslations("signup");
  const dialog = useRef<HTMLDialogElement>(null);
  const email = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pressedOutside = useRef(false);
  const [value, setValue] = useState("");
  const [problem, setProblem] = useState<Problem>(null);
  const [stage, setStage] = useState<"form" | "sending" | "done">("form");

  useEffect(() => () => clearTimeout(timer.current), []);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (stage !== "form") return;
    const address = value.trim();
    const wrong: Problem = !address ? "empty" : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) ? null : "invalid";
    setProblem(wrong);
    if (wrong) return email.current?.focus();
    setStage("sending");
    // shortcut: simulated signup, like the landing's form: nothing is sent or stored. M3 wires both to a real
    // endpoint, with an error path, before launch.
    timer.current = setTimeout(() => setStage("done"), 1200);
  };

  return (
    <>
      <button type="button" className={buttonClass} onClick={() => dialog.current?.showModal()}>{label}</button>
      <dialog
        ref={dialog} className={styles.dialog} aria-labelledby="signup-title"
        // a click on the dimmed page closes it. It must start out there too, so a text selection dragged off the panel doesn't.
        // On click, not press: closing earlier lets the rest of the click land on the page and take the focus.
        onPointerDown={(event) => { pressedOutside.current = event.target === event.currentTarget; }}
        onClick={(event) => { if (pressedOutside.current && event.target === event.currentTarget) event.currentTarget.close(); }}
      >
        <div className={styles.head}>
          <h2 id="signup-title">{t("title")}</h2>
          <button type="button" className={styles.close} onClick={() => dialog.current?.close()} aria-label={t("close")}>
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13" /></svg>
          </button>
        </div>
        <div className={styles.body}>
          <p className={styles.pitch}>{t("pitch")}</p>
          {minutes > 0 && <p className={styles.perk}>{t("perk", { minutes })}</p>}
          {stage === "done" ? (
            <p className={styles.done} role="status">{t("done")}</p>
          ) : (
            <form noValidate onSubmit={submit} aria-busy={stage === "sending"}>
              <label htmlFor="signup-email">{t("email")}</label>
              <input
                ref={email} id="signup-email" type="email" autoComplete="email" placeholder={t("placeholder")} required
                value={value} readOnly={stage === "sending"} aria-invalid={problem ? true : undefined} aria-describedby="signup-error"
                onChange={(event) => { setValue(event.target.value); setProblem(null); }}
              />
              <p className={styles.error} id="signup-error" role="alert">{problem ? t(problem) : ""}</p>
              <button type="submit" className={styles.send} disabled={stage === "sending"}>{t(stage === "sending" ? "sending" : "send")}</button>
              <p className={styles.fine}>{t("fine")}</p>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}
