import { NotFoundCard } from "@/components/layout/NotFoundCard";
import { PRODUCT_NAME } from "@/lib/brand";

export default function RootNotFound() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="page-gutter flex min-h-svh items-center justify-center py-6 outline-none sm:[--gutter:1.5rem]"
    >
      <NotFoundCard backLabel={`Back to ${PRODUCT_NAME}`} />
    </main>
  );
}
