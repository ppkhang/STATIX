"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** A menu link that says when you're on its page, or inside its section (`within`). The style follows aria-current. */
export default function NavLink({ href, within = [], children }: { href: string; within?: string[]; children: React.ReactNode }) {
  const path = usePathname();
  const inside = within.some((section) => path === section || path.startsWith(`${section}/`));
  return <Link href={href} aria-current={path === href ? "page" : inside ? "true" : undefined}>{children}</Link>;
}
