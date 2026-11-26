import { notFound } from "next/navigation";
import { getDrop, parseDropNumber } from "@/lib/catalogue";
import { productMedia } from "@/lib/product-media";
import DropView from "@/components/DropView";

export const dynamic = "force-dynamic"; // stock and drop state are live

export default async function Drop({ params }: PageProps<"/drop/[number]">) {
  const { number: raw } = await params;
  const number = parseDropNumber(raw);
  const drop = number === null ? null : await getDrop(number);
  if (!drop) notFound();
  const media = drop.editions.map((e) => [e.slug, productMedia(e.slug)] as const);
  const art = Object.fromEntries(media.map(([slug, found]) => [slug, found.art]));
  const models = Object.fromEntries(media.map(([slug, found]) => [slug, found.model]));
  return <DropView initial={drop} art={art} models={models} />;
}
