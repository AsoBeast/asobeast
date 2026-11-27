import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { TrackedKeywordItem } from "@asobeast/shared";
import { TestIntlProvider } from "@/test/intl-provider";
import { KeywordPicker } from "./KeywordPicker";

const mocks = vi.hoisted(() => ({
  onSuccess: undefined as
    ((items: TrackedKeywordItem[], texts: string[]) => void) | undefined,
  onError: undefined as ((error: unknown) => void) | undefined,
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  invalidateKeywordMutation: vi.fn(),
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useState: (initial: unknown) => {
      if (initial instanceof Set && initial.size === 0) {
        return [new Set(["focus timer"]), () => undefined];
      }
      return actual.useState(initial);
    },
  };
});

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({}),
  useQuery: () => ({
    data: [],
    isPending: false,
    isError: false,
    error: null,
  }),
  useMutation: (options: {
    onSuccess?: (items: TrackedKeywordItem[], texts: string[]) => void;
    onError?: (error: unknown) => void;
  }) => {
    mocks.onSuccess = options.onSuccess;
    mocks.onError = options.onError;
    return {
      isPending: false,
      mutateAsync: vi.fn(),
    };
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
  },
}));

vi.mock("@/lib/api", () => ({
  addKeywords: vi.fn(),
  ApiError: class ApiError extends Error {},
}));

vi.mock("@/lib/queries", () => ({
  pickerSuggestionsOptions: () => ({}),
  invalidateKeywordMutation: mocks.invalidateKeywordMutation,
}));

vi.mock("@/components/keywords/SuggestionList", () => ({
  SuggestionList: () => <div />,
  suggestionListState: () => ({ status: "ready", suggestions: [] }),
}));

describe("Simplified Chinese keyword picker translator plumbing", () => {
  it("localizes the selection label and tracking toast", () => {
    const markup = renderToStaticMarkup(
      <TestIntlProvider locale="zh-CN">
        <KeywordPicker appId="app-1" country="us" tracked={[]} />
      </TestIntlProvider>,
    );

    expect(markup).toContain("跟踪已选的 1 个");
    expect(markup).not.toContain("Track 1 selected");

    mocks.onSuccess?.([], ["focus timer"]);

    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "正在跟踪 1 个关键词。排名会在几分钟内到达。",
    );

    mocks.onError?.(new Error("offline"));

    expect(mocks.toastError).toHaveBeenCalledWith("无法跟踪所选关键词");
  });
});
