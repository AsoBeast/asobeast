import { ReviewsPageSkeleton } from "@/components/reviews/skeletons";

export default function Loading() {
  return (
    <div className="page-wide">
      <ReviewsPageSkeleton />
    </div>
  );
}
