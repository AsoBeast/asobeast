import type {
  ApiTokenItem,
  EmailAlertItem,
  WebhookEvent,
  WorkspaceTeam,
} from "@asobeast/shared";

export const API_TOKENS_COOKIE = "e2e_api_tokens";
export const SOLO_TEAM_COOKIE = "e2e_team";
export const LONG_ALERT_COOKIE = "e2e-long-alert";

export const API_TOKENS: ApiTokenItem[] = [
  {
    id: "token-ci",
    name: "ci",
    prefix: "asb_9f2c41",
    scope: "read",
    expiresAt: null,
    expired: false,
    lastUsedAt: "2026-10-15T06:00:00.000Z",
    usageCount: 1284,
    createdAt: "2026-09-02T09:00:00.000Z",
  },
  {
    id: "token-agent",
    name: "Desktop agent",
    prefix: "asb_41ab07",
    scope: "write",
    expiresAt: "2027-01-12T00:00:00.000Z",
    expired: false,
    lastUsedAt: "2026-10-14T18:20:00.000Z",
    usageCount: 312,
    createdAt: "2026-10-03T09:00:00.000Z",
  },
  {
    id: "token-old",
    name: "old laptop",
    prefix: "asb_c07d9e",
    scope: "read",
    expiresAt: "2026-09-01T00:00:00.000Z",
    expired: true,
    lastUsedAt: "2026-08-30T11:00:00.000Z",
    usageCount: 57,
    createdAt: "2026-06-01T09:00:00.000Z",
  },
  {
    id: "token-staging",
    name: "staging script",
    prefix: "asb_77e0b2",
    scope: "read",
    expiresAt: null,
    expired: false,
    lastUsedAt: null,
    usageCount: 0,
    createdAt: "2026-10-10T09:00:00.000Z",
  },
];

export const SOLO_TEAM: WorkspaceTeam = {
  members: [
    {
      id: "u1",
      email: "owner@example.com",
      name: "Owner",
      role: "owner",
      createdAt: "2026-07-01T00:00:00.000Z",
    },
  ],
  invites: [],
};

const EVERY_EVENT: WebhookEvent[] = [
  "metadata.changed",
  "rank.dropped",
  "rank.improved",
  "rank.milestone",
  "rank.first",
  "rank.overtaken",
  "review.negative",
  "review.new",
  "review.spike",
  "rating.dropped",
  "serp.entrant",
  "chart.entered",
  "chart.left",
  "chart.milestone",
  "action.opened",
  "app.delisted",
  "app.unlisted_market",
];

export const LONG_ALERT: EmailAlertItem = {
  id: "email-long",
  email:
    "release-notifications-for-the-whole-mobile-team@subdomain.example-company.com",
  events: EVERY_EVENT,
  reviewScores: [1, 2],
  active: true,
  confirmed: true,
  createdAt: "2026-10-01T09:00:00.000Z",
  confirmDrops: true,
  ratingDropTenths: 3,
  rankDropThreshold: 10,
};
