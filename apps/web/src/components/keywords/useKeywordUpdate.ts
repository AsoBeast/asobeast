import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  KeywordUpdateRequest,
  TrackedKeywordItem,
} from "@asobeast/shared";
import { updateKeyword } from "@/lib/api";
import { appKeys, invalidateKeywordMutation } from "@/lib/queries";
import { rollbackKeywordUpdate } from "./keyword-rollback";

export function useKeywordUpdate(appId: string, keyword: TrackedKeywordItem) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (update: KeywordUpdateRequest) =>
      updateKeyword(appId, keyword.keywordId, update),
    onMutate: async (update) => {
      await queryClient.cancelQueries({
        queryKey: appKeys.keywordsRoot(appId),
      });
      const previous = queryClient.getQueriesData<TrackedKeywordItem[]>({
        queryKey: appKeys.keywordsRoot(appId),
      });
      queryClient.setQueriesData<TrackedKeywordItem[]>(
        { queryKey: appKeys.keywordsRoot(appId) },
        (rows) =>
          rows?.map((row) =>
            row.keywordId === keyword.keywordId ? { ...row, ...update } : row,
          ),
      );
      return { previous };
    },
    onError: (_error, update, context) => {
      context?.previous.forEach(([key, data]) => {
        queryClient.setQueryData<TrackedKeywordItem[]>(key, (current) =>
          rollbackKeywordUpdate(current, data, keyword.keywordId, update),
        );
      });
      toast.error(`Could not update ${keyword.text}`);
    },
    onSettled: () => invalidateKeywordMutation(queryClient, appId),
  });
}
