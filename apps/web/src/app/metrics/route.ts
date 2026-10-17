import { apiRoute } from "@/lib/api/proxy";

export const GET = apiRoute("metrics");
export { POST, PUT, PATCH, DELETE, OPTIONS } from "@/lib/api/refused-methods";
