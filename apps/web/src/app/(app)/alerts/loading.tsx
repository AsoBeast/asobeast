import { AlertFeedSkeleton } from "@/components/alerts/AlertFeedStates";

export default function Loading() {
  return (
    <div className="page-wide @container/alerts flex flex-col gap-6">
      <AlertFeedSkeleton />
    </div>
  );
}
