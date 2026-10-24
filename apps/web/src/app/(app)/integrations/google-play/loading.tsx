import { PlaySignInReturnSkeleton } from "@/components/integrations/skeletons";

export default function Loading() {
  return (
    <div className="page-reading flex flex-col gap-8">
      <PlaySignInReturnSkeleton />
    </div>
  );
}
