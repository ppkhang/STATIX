import { notFound } from "next/navigation";
import { getDrop, parseDropNumber } from "@/lib/catalogue";
import DropView from "@/components/DropView";

export const dynamic = "force-dynamic"; // stock and drop state are live

export default async function Drop({ params }: PageProps<"/drop/[number]">) {
  const { number: raw } = await params;
  const number = parseDropNumber(raw);
  const drop = number === null ? null : await getDrop(number);
  if (!drop) notFound();
  return <DropView initial={drop} />;
}
