import { SignedOutPage } from "@/components/auth/SignedOutHeader";
import { NotFoundCard } from "@/components/layout/NotFoundCard";
import { PRODUCT_NAME } from "@/lib/brand";

export default function RootNotFound() {
  return (
    <SignedOutPage>
      <NotFoundCard backLabel={`Back to ${PRODUCT_NAME}`} />
    </SignedOutPage>
  );
}
