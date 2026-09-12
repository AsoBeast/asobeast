import { expect, test } from "@playwright/test";
import {
  DEV_ONLY_ROUTES,
  pageRoutes,
  SIGNED_IN_ROUTES,
  SIGNED_OUT_ROUTES,
} from "./routes.mts";

test("the route lists cover every page in the app directory", () => {
  const listed = [
    ...SIGNED_IN_ROUTES,
    ...SIGNED_OUT_ROUTES,
    ...DEV_ONLY_ROUTES,
  ].map(([, path]) => path);

  expect(pageRoutes().sort()).toEqual([...listed].sort());
});
