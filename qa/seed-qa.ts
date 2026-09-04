/**
 * QA regression seed. Creates a deterministic, edge-case-heavy dataset because the
 * sandbox blocks the live store endpoints, so the normal import path cannot run.
 * Run from apps/api:  pnpm exec ts-node --project tsconfig.json ../../qa/seed-qa.ts
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is not set');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const WS = 'ws_default';
const XSS = '<script>alert(1)</script>';
const SQLI = "'; DROP TABLE \"Keyword\"; --";

const day = (offset: number) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - offset);
  return d;
};

async function main() {
  // --- Primary Apple app: normal, realistic listing ---------------------------
  const primary = await prisma.app.create({
    data: {
      workspaceId: WS,
      store: 'APP_STORE',
      storeAppId: '6657987209',
      country: 'us',
      name: 'GeoGuess Map Quiz',
      iconUrl: 'https://example.invalid/icon-primary.png',
    },
  });

  // --- Unicode / RTL / emoji / very-long-string app (presentation edge cases) --
  const unicodeApp = await prisma.app.create({
    data: {
      workspaceId: WS,
      store: 'GOOGLE_PLAY',
      storeAppId: 'com.qa.unicode',
      country: 'pl',
      name: 'Zażółć gęślą jaźń 🎮 مرحبا 你好 — ' + 'X'.repeat(180),
      iconUrl: 'https://example.invalid/icon-unicode.png',
    },
  });

  // --- Competitors of the primary app ----------------------------------------
  const competitors = await Promise.all(
    [
      { storeAppId: '1111111111', name: 'Rival Atlas' },
      { storeAppId: '2222222222', name: XSS + ' Injected Competitor' },
    ].map((c) =>
      prisma.app.create({
        data: {
          workspaceId: WS,
          store: 'APP_STORE',
          storeAppId: c.storeAppId,
          country: 'us',
          name: c.name,
          isCompetitor: true,
          primaryAppId: primary.id,
        },
      }),
    ),
  );

  // --- Snapshots: one rich, one with hostile + boundary content ---------------
  await prisma.appSnapshot.create({
    data: {
      appId: primary.id,
      title: 'GeoGuess Map Quiz: World Geography',
      subtitle: 'Guess the place from the street',
      description:
        'Explore the world and guess where you are. Daily challenges, maps and country quizzes.',
      ratingAvg: 4.6,
      ratingCount: 21843,
      price: 0,
      version: '3.4.1',
      releasedAt: day(400),
      storeUpdatedAt: day(9),
      raw: { source: 'qa-seed' },
      capturedAt: day(9),
    },
  });
  await prisma.appSnapshot.create({
    data: {
      appId: unicodeApp.id,
      title: 'Zażółć gęślą jaźń 🎮 مرحبا 你好',
      summary: 'Krótki opis ze znakami diakrytycznymi ąćęłńóśźż i emoji 🚀',
      description: XSS + '\n' + SQLI + '\n' + 'Ł'.repeat(4000),
      ratingAvg: 0,
      ratingCount: 0,
      installs: BigInt('9007199254740993'), // beyond IEEE754 safe integer
      price: 0,
      version: '0.0.1-β',
      raw: { source: 'qa-seed', hostile: true },
      capturedAt: day(1),
    },
  });

  // --- 210 keywords for pagination / virtualization / sorting stability -------
  const keywordTexts: string[] = [];
  for (let i = 1; i <= 200; i += 1) {
    keywordTexts.push(`bulk keyword ${String(i).padStart(3, '0')}`);
  }
  keywordTexts.push(
    'geography quiz',
    'map game',
    'zażółć gęślą jaźń',
    '你好世界',
    'مرحبا بالعالم',
    '🎮 emoji keyword',
    XSS,
    SQLI,
    'a'.repeat(100),
    '   leading and trailing   ',
  );

  const keywords = [];
  for (const text of keywordTexts) {
    keywords.push(
      await prisma.keyword.create({
        data: { text, store: 'APP_STORE', country: 'us' },
      }),
    );
  }

  await prisma.trackedKeyword.createMany({
    data: keywords.map((k) => ({
      appId: primary.id,
      keywordId: k.id,
      source: 'MANUAL' as const,
      active: true,
    })),
  });

  // --- Ranking history: 60 days, plus deliberate chart edge cases -------------
  const rankingRows: {
    appId: string;
    workspaceId: string;
    keywordId: string;
    date: Date;
    position: number | null;
  }[] = [];

  // keywords[200] = 'geography quiz' -> full 60-day trend with gaps (null = not found)
  for (let d = 0; d < 60; d += 1) {
    rankingRows.push({
      appId: primary.id,
      workspaceId: WS,
      keywordId: keywords[200].id,
      date: day(d),
      position: d % 11 === 0 ? null : Math.max(1, 40 + Math.round(Math.sin(d / 5) * 18)),
    });
  }
  // keywords[201] = 'map game' -> flat line (same position every day)
  for (let d = 0; d < 30; d += 1) {
    rankingRows.push({
      appId: primary.id,
      workspaceId: WS,
      keywordId: keywords[201].id,
      date: day(d),
      position: 7,
    });
  }
  // keywords[202] -> exactly one data point (single-point chart)
  rankingRows.push({
    appId: primary.id,
    workspaceId: WS,
    keywordId: keywords[202].id,
    date: day(0),
    position: 200,
  });
  // keywords[203] -> only nulls: checked, never found within depth 200
  for (let d = 0; d < 10; d += 1) {
    rankingRows.push({
      appId: primary.id,
      workspaceId: WS,
      keywordId: keywords[203].id,
      date: day(d),
      position: null,
    });
  }
  // Bulk keywords get a single recent position so list sorting has data
  for (let i = 0; i < 60; i += 1) {
    rankingRows.push({
      appId: primary.id,
      workspaceId: WS,
      keywordId: keywords[i].id,
      date: day(0),
      position: ((i * 7) % 199) + 1,
    });
  }
  await prisma.keywordRanking.createMany({ data: rankingRows });

  // Competitor rankings on the shared keyword, so competitor views have data
  await prisma.keywordRanking.createMany({
    data: competitors.flatMap((c) =>
      [0, 1, 2].map((d) => ({
        appId: c.id,
        workspaceId: WS,
        keywordId: keywords[200].id,
        date: day(d),
        position: 12 + d,
      })),
    ),
  });

  // --- Keyword metrics: boundary numeric values -------------------------------
  await prisma.keywordMetric.createMany({
    data: [
      {
        keywordId: keywords[200].id,
        date: day(0),
        traffic: 62.5,
        difficulty: 48.2,
        scoringSource: 'qa-seed',
        formulaVersion: 'v1',
        confidence: 'high',
        capturedAt: day(0),
      },
      {
        keywordId: keywords[201].id,
        date: day(0),
        traffic: 0,
        difficulty: 0,
        scoringSource: 'qa-seed',
        formulaVersion: 'v1',
        confidence: 'low',
        capturedAt: day(0),
      },
      {
        keywordId: keywords[202].id,
        date: day(0),
        traffic: 100,
        difficulty: 100,
        scoringSource: 'qa-seed',
        formulaVersion: 'v1',
        confidence: 'medium',
        capturedAt: day(0),
      },
    ],
  });

  // --- SERP entries -----------------------------------------------------------
  await prisma.serpEntry.createMany({
    data: Array.from({ length: 20 }, (_, i) => ({
      keywordId: keywords[200].id,
      date: day(0),
      position: i + 1,
      storeAppId: i === 0 ? primary.storeAppId : `serp-app-${i}`,
      title: i === 3 ? XSS : `SERP result ${i + 1}`,
      developer: `Dev ${i + 1}`,
      ratingAvg: 3 + (i % 3) * 0.5,
      ratingCount: i * 137,
    })),
  });

  // --- Reviews: unicode, XSS, boundary scores, missing fields -----------------
  await prisma.review.createMany({
    data: [
      {
        appId: primary.id,
        reviewId: 'r-1',
        userName: 'Happy User',
        score: 5,
        title: 'Love it',
        text: 'Best geography app, the daily challenge keeps me coming back.',
        version: '3.4.1',
        reviewedAt: day(2),
      },
      {
        appId: primary.id,
        reviewId: 'r-2',
        userName: 'Zażółć 🎮',
        score: 1,
        title: 'Crashuje',
        text: 'Aplikacja się zawiesza przy starcie. ąćęłńóśźż',
        version: '3.4.0',
        reviewedAt: day(3),
      },
      {
        appId: primary.id,
        reviewId: 'r-3',
        userName: XSS,
        score: 3,
        title: XSS,
        text: XSS + ' mixed with normal text',
        version: null,
        reviewedAt: day(4),
      },
      {
        appId: primary.id,
        reviewId: 'r-4',
        userName: null,
        score: 2,
        title: null,
        text: 'L'.repeat(9000),
        version: '3.3.0',
        reviewedAt: null,
      },
      {
        appId: primary.id,
        reviewId: 'r-5',
        userName: 'مستخدم',
        score: 4,
        title: 'جيد',
        text: 'تطبيق رائع لتعلم الجغرافيا',
        version: '3.4.1',
        reviewedAt: day(1),
      },
    ],
  });

  // --- Change events ----------------------------------------------------------
  await prisma.changeEvent.createMany({
    data: [
      {
        appId: primary.id,
        field: 'title',
        before: 'GeoGuess Map Quiz',
        after: 'GeoGuess Map Quiz: World Geography',
        capturedAt: day(9),
      },
      {
        appId: primary.id,
        field: 'description',
        before: 'Old description',
        after: XSS,
        capturedAt: day(5),
      },
      {
        appId: primary.id,
        field: 'version',
        before: '3.4.0',
        after: '3.4.1',
        capturedAt: day(9),
      },
    ],
  });

  // --- Category ranks ---------------------------------------------------------
  await prisma.categoryRank.createMany({
    data: [0, 1, 2, 3, 4].map((d) => ({
      appId: primary.id,
      date: day(d),
      collection: 'TOP_FREE',
      genre: 'GAMES_TRIVIA',
      position: d === 2 ? null : 30 + d,
    })),
  });

  console.log(
    JSON.stringify(
      {
        primaryAppId: primary.id,
        unicodeAppId: unicodeApp.id,
        competitorIds: competitors.map((c) => c.id),
        keywordCount: keywords.length,
        trendKeywordId: keywords[200].id,
        flatKeywordId: keywords[201].id,
        singlePointKeywordId: keywords[202].id,
        allNullKeywordId: keywords[203].id,
        xssKeywordId: keywords[206].id,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
