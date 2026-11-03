"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { logout } from "@/lib/api";
import { invalidateAuth } from "@/lib/queries";

export function useSignOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => logout(),
    onSuccess: () => {
      invalidateAuth(queryClient);
      window.location.replace("/login");
    },
    onError: () => toast.error("Could not sign out."),
  });
}
