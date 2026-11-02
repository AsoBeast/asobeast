import { useQueryStates } from "nuqs";
import { serpDateParser, serpParser } from "@/lib/search-params";

export const useSerpParams = () =>
  useQueryStates({ serp: serpParser, serpDate: serpDateParser });
