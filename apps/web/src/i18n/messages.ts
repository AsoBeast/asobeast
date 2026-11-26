import type { Locale } from "@/lib/locale";

import enAccount from "../../messages/en/account.json";
import enActions from "../../messages/en/actions.json";
import enAlerts from "../../messages/en/alerts.json";
import enAdmin from "../../messages/en/admin.json";
import enAppDetail from "../../messages/en/appDetail.json";
import enApps from "../../messages/en/apps.json";
import enAudit from "../../messages/en/audit.json";
import enAuth from "../../messages/en/auth.json";
import enBilling from "../../messages/en/billing.json";
import enChanges from "../../messages/en/changes.json";
import enCharts from "../../messages/en/charts.json";
import enCommon from "../../messages/en/common.json";
import enCompetitors from "../../messages/en/competitors.json";
import enDashboard from "../../messages/en/dashboard.json";
import enDatePicker from "../../messages/en/datePicker.json";
import enErrors from "../../messages/en/errors.json";
import enFormat from "../../messages/en/format.json";
import enIntegrations from "../../messages/en/integrations.json";
import enJobs from "../../messages/en/jobs.json";
import enKeywordInspector from "../../messages/en/keywordInspector.json";
import enKeywords from "../../messages/en/keywords.json";
import enLanguages from "../../messages/en/languages.json";
import enLegal from "../../messages/en/legal.json";
import enLocalizations from "../../messages/en/localizations.json";
import enMetadata from "../../messages/en/metadata.json";
import enMetrics from "../../messages/en/metrics.json";
import enNavigation from "../../messages/en/navigation.json";
import enNotifications from "../../messages/en/notifications.json";
import enOverview from "../../messages/en/overview.json";
import enRankings from "../../messages/en/rankings.json";
import enReleaseNotes from "../../messages/en/releaseNotes.json";
import enReviews from "../../messages/en/reviews.json";
import enScreenshots from "../../messages/en/screenshots.json";
import enSeo from "../../messages/en/seo.json";
import enSettings from "../../messages/en/settings.json";
import enSetup from "../../messages/en/setup.json";
import enShell from "../../messages/en/shell.json";
import enSystemNotices from "../../messages/en/systemNotices.json";
import enTeam from "../../messages/en/team.json";
import enTopCharts from "../../messages/en/topCharts.json";
import enUi from "../../messages/en/ui.json";
import enValidation from "../../messages/en/validation.json";
import enWorkspace from "../../messages/en/workspace.json";
import zhAccount from "../../messages/zh-CN/account.json";
import zhActions from "../../messages/zh-CN/actions.json";
import zhAlerts from "../../messages/zh-CN/alerts.json";
import zhAdmin from "../../messages/zh-CN/admin.json";
import zhAppDetail from "../../messages/zh-CN/appDetail.json";
import zhApps from "../../messages/zh-CN/apps.json";
import zhAudit from "../../messages/zh-CN/audit.json";
import zhAuth from "../../messages/zh-CN/auth.json";
import zhBilling from "../../messages/zh-CN/billing.json";
import zhChanges from "../../messages/zh-CN/changes.json";
import zhCharts from "../../messages/zh-CN/charts.json";
import zhCommon from "../../messages/zh-CN/common.json";
import zhCompetitors from "../../messages/zh-CN/competitors.json";
import zhDashboard from "../../messages/zh-CN/dashboard.json";
import zhDatePicker from "../../messages/zh-CN/datePicker.json";
import zhErrors from "../../messages/zh-CN/errors.json";
import zhFormat from "../../messages/zh-CN/format.json";
import zhIntegrations from "../../messages/zh-CN/integrations.json";
import zhJobs from "../../messages/zh-CN/jobs.json";
import zhKeywordInspector from "../../messages/zh-CN/keywordInspector.json";
import zhKeywords from "../../messages/zh-CN/keywords.json";
import zhLanguages from "../../messages/zh-CN/languages.json";
import zhLegal from "../../messages/zh-CN/legal.json";
import zhLocalizations from "../../messages/zh-CN/localizations.json";
import zhMetadata from "../../messages/zh-CN/metadata.json";
import zhMetrics from "../../messages/zh-CN/metrics.json";
import zhNavigation from "../../messages/zh-CN/navigation.json";
import zhNotifications from "../../messages/zh-CN/notifications.json";
import zhOverview from "../../messages/zh-CN/overview.json";
import zhRankings from "../../messages/zh-CN/rankings.json";
import zhReleaseNotes from "../../messages/zh-CN/releaseNotes.json";
import zhReviews from "../../messages/zh-CN/reviews.json";
import zhScreenshots from "../../messages/zh-CN/screenshots.json";
import zhSeo from "../../messages/zh-CN/seo.json";
import zhSettings from "../../messages/zh-CN/settings.json";
import zhSetup from "../../messages/zh-CN/setup.json";
import zhShell from "../../messages/zh-CN/shell.json";
import zhSystemNotices from "../../messages/zh-CN/systemNotices.json";
import zhTeam from "../../messages/zh-CN/team.json";
import zhTopCharts from "../../messages/zh-CN/topCharts.json";
import zhUi from "../../messages/zh-CN/ui.json";
import zhValidation from "../../messages/zh-CN/validation.json";
import zhWorkspace from "../../messages/zh-CN/workspace.json";

export const messageNamespaces = [
  "common",
  "navigation",
  "auth",
  "errors",
  "ui",
  "format",
  "shell",
  "seo",
  "datePicker",
  "validation",
  "languages",
  "legal",
  "localizations",
  "systemNotices",
  "billing",
  "account",
  "settings",
  "team",
  "workspace",
  "notifications",
  "dashboard",
  "apps",
  "setup",
  "overview",
  "appDetail",
  "jobs",
  "metrics",
  "keywords",
  "keywordInspector",
  "rankings",
  "competitors",
  "metadata",
  "screenshots",
  "changes",
  "audit",
  "actions",
  "alerts",
  "charts",
  "topCharts",
  "reviews",
  "admin",
  "integrations",
  "releaseNotes",
] as const;

export type MessageNamespace = (typeof messageNamespaces)[number];

export const catalogs: Record<Locale, Record<MessageNamespace, unknown>> = {
  en: {
    common: enCommon,
    navigation: enNavigation,
    auth: enAuth,
    errors: enErrors,
    ui: enUi,
    format: enFormat,
    shell: enShell,
    seo: enSeo,
    datePicker: enDatePicker,
    validation: enValidation,
    languages: enLanguages,
    legal: enLegal,
    localizations: enLocalizations,
    systemNotices: enSystemNotices,
    billing: enBilling,
    account: enAccount,
    settings: enSettings,
    team: enTeam,
    workspace: enWorkspace,
    notifications: enNotifications,
    dashboard: enDashboard,
    apps: enApps,
    setup: enSetup,
    overview: enOverview,
    appDetail: enAppDetail,
    jobs: enJobs,
    metrics: enMetrics,
    keywords: enKeywords,
    keywordInspector: enKeywordInspector,
    rankings: enRankings,
    competitors: enCompetitors,
    metadata: enMetadata,
    screenshots: enScreenshots,
    changes: enChanges,
    audit: enAudit,
    actions: enActions,
    alerts: enAlerts,
    charts: enCharts,
    topCharts: enTopCharts,
    reviews: enReviews,
    admin: enAdmin,
    integrations: enIntegrations,
    releaseNotes: enReleaseNotes,
  },
  "zh-CN": {
    common: zhCommon,
    navigation: zhNavigation,
    auth: zhAuth,
    errors: zhErrors,
    ui: zhUi,
    format: zhFormat,
    shell: zhShell,
    seo: zhSeo,
    datePicker: zhDatePicker,
    validation: zhValidation,
    languages: zhLanguages,
    legal: zhLegal,
    localizations: zhLocalizations,
    systemNotices: zhSystemNotices,
    billing: zhBilling,
    account: zhAccount,
    settings: zhSettings,
    team: zhTeam,
    workspace: zhWorkspace,
    notifications: zhNotifications,
    dashboard: zhDashboard,
    apps: zhApps,
    setup: zhSetup,
    overview: zhOverview,
    appDetail: zhAppDetail,
    jobs: zhJobs,
    metrics: zhMetrics,
    keywords: zhKeywords,
    keywordInspector: zhKeywordInspector,
    rankings: zhRankings,
    competitors: zhCompetitors,
    metadata: zhMetadata,
    screenshots: zhScreenshots,
    changes: zhChanges,
    audit: zhAudit,
    actions: zhActions,
    alerts: zhAlerts,
    charts: zhCharts,
    topCharts: zhTopCharts,
    reviews: zhReviews,
    admin: zhAdmin,
    integrations: zhIntegrations,
    releaseNotes: zhReleaseNotes,
  },
};

export async function loadMessages(
  locale: Locale,
): Promise<Record<string, unknown>> {
  return catalogs[locale];
}
