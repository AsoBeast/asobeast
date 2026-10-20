import {
  NEXT_ROUTER_PREFETCH_HEADER,
  NEXT_ROUTER_SEGMENT_PREFETCH_HEADER,
  NEXT_ROUTER_STATE_TREE_HEADER,
  RSC_HEADER,
} from "next/dist/client/components/app-router-headers";
import { describe, expect, it } from "vitest";
import { RSC_VARY_HEADER } from "./rsc-vary";

describe("RSC_VARY_HEADER", () => {
  it("names the request headers Next.js varies an app router response on", () => {
    expect(RSC_VARY_HEADER.split(", ")).toEqual([
      RSC_HEADER,
      NEXT_ROUTER_STATE_TREE_HEADER,
      NEXT_ROUTER_PREFETCH_HEADER,
      NEXT_ROUTER_SEGMENT_PREFETCH_HEADER,
    ]);
  });
});
