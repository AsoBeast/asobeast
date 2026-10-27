import { SessionCheck } from "@/components/auth/SessionCheck";

export default function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center py-12">
      <SessionCheck />
    </div>
  );
}
