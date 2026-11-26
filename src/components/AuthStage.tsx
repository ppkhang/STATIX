import SignalBackdrop from "./SignalBackdrop";
import styles from "./auth.module.css";

type Props = {
  title: string;
  /** Goes on the light surface inside the box. */
  children: React.ReactNode;
  /** Goes on the dark page under the box. */
  below: React.ReactNode;
};

/** The frame shared by log in and sign up. `.slab` is the landing's title block, from globals.css. */
export default function AuthStage({ title, children, below }: Props) {
  return (
    <>
      <SignalBackdrop />
      <div className={styles.stage}>
        <h1 className={`slab ${styles.title}`}>{title}</h1>
        <div className={styles.console}>
          <div className={styles.surface}>{children}</div>
        </div>
        {below}
      </div>
    </>
  );
}
