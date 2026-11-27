import AuthTabs from "@/components/AuthTabs";
import SignalBackdrop from "@/components/SignalBackdrop";
import styles from "@/components/auth.module.css";

/** What log in and sign up share. It stays mounted between them, so the art keeps running and the tabs can slide. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SignalBackdrop />
      <div className={styles.stage} data-entry="">
        <AuthTabs />
        {children}
      </div>
    </>
  );
}
