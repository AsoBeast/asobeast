import { SignedOutPage } from "@/components/auth/SignedOutHeader";
import { NotFoundCard } from "@/components/layout/NotFoundCard";

export default function RootNotFound() {
  return (
    <SignedOutPage>
      <NotFoundCard />
    </SignedOutPage>
  );
}
