import { notFound } from "next/navigation";
import { TokenReference } from "@/components/tokens/TokenReference";

export default function TokensPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return <TokenReference />;
}
