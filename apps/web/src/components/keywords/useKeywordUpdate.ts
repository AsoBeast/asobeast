import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  KeywordUpdateRequest,
  TrackedKeywordItem,
} from "@asobeast/shared";
import { updateKeyword } from "@/lib/api";
import { appKeys, invalidateKeywordMutation } from "@/lib/queries";
import { answeredKeyword, optimisticKeyword } from "./keyword-class";
import { rollbackKeywordUpdate } from "./keyword-rollback";

export function useKeywordUpdate(appId: string, keyword: TrackedKeywordItem) {
  const queryClient = useQueryClient();
  const updateRow = (change: (row: TrackedKeywordItem) => TrackedKeywordItem) =>
    queryClient.setQueriesData<TrackedKeywordItem[]>(
      { queryKey: appKeys.keywordsRoot(appId) },
      (rows) =>
        rows?.map((row) =>
          row.keywordId === keyword.keywordId ? change(row) : row,
        ),
    );

  return useMutation({
    scope: { id: `keyword-update:${appId}:${keyword.keywordId}` },
    mutationFn: (update: KeywordUpdateRequest) =>
      updateKeyword(appId, keyword.keywordId, update),
    onMutate: async (update) => {
      await queryClient.cancelQueries({
        queryKey: appKeys.keywordsRoot(appId),
      });
      const previous = queryClient.getQueriesData<TrackedKeywordItem[]>({
        queryKey: appKeys.keywordsRoot(appId),
      });
      updateRow((row) => optimisticKeyword(row, update));
      return { previous };
    },
    onSuccess: (answer, update) => {
      if (update.keywordClass === null) {
        updateRow((row) => answeredKeyword(row, answer));
      }
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
