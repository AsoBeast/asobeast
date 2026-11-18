import { parseAppStorePage } from './app-store-page';
import {
  SIMILAR_PAGE_HTML,
  SIMILAR_SHELF_ADAM_IDS,
  SIMILAR_SHELF_LOCKUPS,
} from './app-store-similar.fixture';

const TRAILER_URL =
  'https://apptrailers.itunes.apple.com/itunes-assets/PurpleVideo211/v4/d4/40/6e/d4406ee8-62de-501d-9a05-9370a87b1142/P1497996222_default.m3u8';

const pageOf = (shelves: Record<string, unknown>): string =>
  `<h1>Pokémon GO</h1><script type="application/json" id="serialized-server-data">${JSON.stringify(
    { data: [{ data: { shelfMapping: shelves } }] },
  )}</script>`;

const shelfOf = (items: unknown[]): Record<string, unknown> => ({
  $kind: 'Shelf',
  contentType: 'shelf',
  marker: null,
  items,
});

const POGO_MEDIA_SHELF = shelfOf([
  {
    $kind: 'ProductMediaItem',
    video: {
      $kind: 'Video',
      videoUrl: TRAILER_URL,
      preview: {
        $kind: 'Artwork',
        template:
          'https://is1-ssl.mzstatic.com/image/thumb/keyframe.png/{w}x{h}{c}.{f}',
        width: 886,
        height: 1920,
      },
      playbackControls: { prominentPlay: true },
    },
  },
  {
    $kind: 'ProductMediaItem',
    screenshot: {
      $kind: 'Artwork',
      template:
        'https://is1-ssl.mzstatic.com/image/thumb/shot.png/{w}x{h}{c}.{f}',
      width: 1320,
      height: 2868,
    },
  },
]);

const POGO_EVENT = {
  $kind: 'AppEvent',
  promotionType: 'appEvent',
  appEventId: '6822418007',
  title: 'Pokémon GO Wild Area: Global',
  subtitle: 'Gigantamax Duraludon will make its debut!',
  detail: 'Prepare to encounter Steel and Dragon types',
  moduleArtwork: { $kind: 'Artwork', template: 'https://artwork/{w}x{h}' },
  startDate: '2026-11-14T15:00:00.000Z',
  endDate: '2026-11-16T04:00:00.000Z',
  appEventBadgeKind: 'happening',
  kind: 'SPECIAL EVENT',
  lockup: { $kind: 'Lockup', title: 'Pokémon GO', adamId: '1094591345' },
};

const storyCard = (heading: string, title: string, pageUrl: string) => ({
  $kind: 'TodayCard',
  heading,
  title,
  media: {
    kind: 'artwork',
    artworks: [{ $kind: 'Artwork', template: 'https' }],
  },
  clickAction: {
    $kind: 'flowAction',
    actionClass: 'FlowAction',
    page: 'article',
    pageUrl,
    title,
  },
});

const POGO_STORIES = [
  storyCard(
    'GAMES WE LOVE',
    'Pokémon GO',
    'https://apps.apple.com/us/iphone/story/id1489151401',
  ),
  storyCard(
    'HOW TO',
    'Trade Pokémon With Friends',
    'https://apps.apple.com/us/iphone/story/id1393333915',
  ),
];

const EDITORS_CHOICE_SHELF = shelfOf([
  {
    $kind: 'ProductReview',
    componentType: 'productReview',
    sourceType: 'editorsChoice',
    review: {
      $kind: 'EditorsChoice',
      showsBadge: true,
      notes: 'A phenomenon from the start, Pokémon GO hasn’t stopped evolving.',
      isCollapsed: true,
    },
  },
]);

const SIMILAR_LOCKUP = {
  $kind: 'Lockup',
  adamId: '284035177',
  title: 'Pandora: Personalized Music',
  subtitle: 'Discover New Songs & Artists',
  developerName: 'Pandora Media, LLC',
  rating: 4.8,
  ratingCount: '11M',
  icon: {
    $kind: 'Artwork',
    template:
      'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource221/v4/65/db/6f/65db6f74-dce2-d273-4daf-8b897e21db40/Placeholder.mill/{w}x{h}{c}.{f}',
  },
};

const ACCESSIBILITY_SHELF = shelfOf([
  {
    $kind: 'AccessibilityParagraph',
    text: {
      $kind: 'LinkableText',
      styledText: {
        $kind: 'StyledText',
        rawText:
          'The developer has not yet indicated which accessibility features this app supports. Learn More',
        rawTextType: 'text/x-apple-as3-nqml',
      },
      linkedSubstrings: {
        'Learn More': { pageUrl: 'https://apps.apple.com/story/id1814164299' },
      },
    },
  },
]);

const CALM_MEDIA_SHELF = shelfOf([
  {
    $kind: 'ProductMediaItem',
    screenshot: {
      $kind: 'Artwork',
      template:
        'https://is1-ssl.mzstatic.com/image/thumb/calm.png/{w}x{h}{c}.{f}',
      width: 1320,
      height: 2868,
    },
  },
]);

describe('parseAppStorePage', () => {
  it('reads every tracked shelf of a page that carries all of them', () => {
    const extract = parseAppStorePage(
      pageOf({
        topLockup: shelfOf([{ $kind: 'Lockup', title: 'Pokémon GO' }]),
        product_media_phone_: POGO_MEDIA_SHELF,
        appEvents: shelfOf([POGO_EVENT]),
        featuredIn: shelfOf(POGO_STORIES),
        editorsChoiceProductReviews: EDITORS_CHOICE_SHELF,
        accessibilityHeader: ACCESSIBILITY_SHELF,
        similarItems: shelfOf([SIMILAR_LOCKUP]),
      }),
    );

    expect(extract).toEqual({
      previewVideoUrls: [TRAILER_URL],
      appEvents: [
        {
          appEventId: '6822418007',
          title: 'Pokémon GO Wild Area: Global',
          kind: 'SPECIAL EVENT',
          badge: 'happening',
          startsAt: '2026-11-14T15:00:00.000Z',
          endsAt: '2026-11-16T04:00:00.000Z',
        },
      ],
      featuredStories: [
        {
          storyId: '1489151401',
          heading: 'GAMES WE LOVE',
          title: 'Pokémon GO',
        },
        {
          storyId: '1393333915',
          heading: 'HOW TO',
          title: 'Trade Pokémon With Friends',
        },
      ],
      editorsChoice: {
        showsBadge: true,
        notes:
          'A phenomenon from the start, Pokémon GO hasn’t stopped evolving.',
      },
      accessibilityStatement:
        'The developer has not yet indicated which accessibility features this app supports. Learn More',
      similarItems: [
        {
          adamId: '284035177',
          title: 'Pandora: Personalized Music',
          subtitle: 'Discover New Songs & Artists',
          developer: 'Pandora Media, LLC',
          rating: 4.8,
          ratingCount: '11M',
          iconTemplate:
            'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource221/v4/65/db/6f/65db6f74-dce2-d273-4daf-8b897e21db40/Placeholder.mill/{w}x{h}{c}.{f}',
        },
      ],
    });
  });

  it('answers empty lists for a page whose shelves are absent, not broken', () => {
    const extract = parseAppStorePage(
      pageOf({
        product_media_phone_: CALM_MEDIA_SHELF,
        featuredIn: shelfOf(POGO_STORIES),
        editorsChoiceProductReviews: EDITORS_CHOICE_SHELF,
        accessibilityHeader: ACCESSIBILITY_SHELF,
      }),
    );

    expect(extract.previewVideoUrls).toEqual([]);
    expect(extract.appEvents).toEqual([]);
    expect(extract.featuredStories).toHaveLength(2);
    expect(extract.editorsChoice).not.toBeNull();
    expect(extract.accessibilityStatement).not.toBeNull();
  });

  it('collects a trailer from every product media shelf', () => {
    const padTrailer = `${TRAILER_URL}?pad`;
    const extract = parseAppStorePage(
      pageOf({
        product_media_phone_: CALM_MEDIA_SHELF,
        product_media_pad_: shelfOf([
          { $kind: 'ProductMediaItem', video: { videoUrl: padTrailer } },
        ]),
        product_media_watch_: shelfOf([
          {
            $kind: 'ProductMediaItem',
            video: { videoUrl: `${TRAILER_URL}?watch` },
          },
        ]),
      }),
    );

    const previewVideoUrls = extract.previewVideoUrls;
    expect(previewVideoUrls).not.toBeNull();
    expect([...(previewVideoUrls ?? [])].sort()).toEqual([
      `${TRAILER_URL}?pad`,
      `${TRAILER_URL}?watch`,
    ]);
  });

  it('stores a trailer url repeated across shelves once', () => {
    const extract = parseAppStorePage(
      pageOf({
        product_media_phone_: shelfOf([
          { $kind: 'ProductMediaItem', video: { videoUrl: TRAILER_URL } },
        ]),
        product_media_pad_: shelfOf([
          { $kind: 'ProductMediaItem', video: { videoUrl: TRAILER_URL } },
        ]),
      }),
    );

    expect(extract.previewVideoUrls).toEqual([TRAILER_URL]);
  });

  it('answers null preview videos for an empty shelf mapping', () => {
    expect(parseAppStorePage(pageOf({}))).toEqual({
      previewVideoUrls: null,
      appEvents: [],
      featuredStories: [],
      editorsChoice: null,
      accessibilityStatement: null,
      similarItems: [],
    });
  });

  it('answers null preview videos when the shelf mapping holds no media shelves', () => {
    const extract = parseAppStorePage(
      pageOf({ appEvents: shelfOf([POGO_EVENT]) }),
    );

    expect(extract.previewVideoUrls).toBeNull();
    expect(extract.appEvents).toHaveLength(1);
  });

  it('answers null preview videos when a media shelf carries no item array', () => {
    const extract = parseAppStorePage(
      pageOf({ product_media_phone_: { $kind: 'Shelf' } }),
    );

    expect(extract.previewVideoUrls).toBeNull();
  });

  it('still counts a readable media shelf beside a malformed one', () => {
    const extract = parseAppStorePage(
      pageOf({
        product_media_phone_: shelfOf([
          { $kind: 'ProductMediaItem', video: { videoUrl: TRAILER_URL } },
        ]),
        product_media_pad_: { $kind: 'Shelf' },
      }),
    );

    expect(extract.previewVideoUrls).toEqual([TRAILER_URL]);
  });

  it('throws when the page embeds no serialized server data', () => {
    expect(() =>
      parseAppStorePage(
        '<!DOCTYPE html><html><body><div class="body-container"></div></body></html>',
      ),
    ).toThrow('product page embeds no serialized server data');
  });

  it('throws when the embedded data is not valid JSON', () => {
    expect(() =>
      parseAppStorePage(
        '<script type="application/json" id="serialized-server-data">{"data":[</script>',
      ),
    ).toThrow('serialized server data is not valid JSON');
  });

  it('throws when the embedded data carries no shelf mapping', () => {
    expect(() =>
      parseAppStorePage(
        '<script type="application/json" id="serialized-server-data">{"data":[]}</script>',
      ),
    ).toThrow('serialized server data carries no shelf mapping');
  });

  it('throws when the data entries carry no shelf mapping object', () => {
    expect(() =>
      parseAppStorePage(
        '<script type="application/json" id="serialized-server-data">{"data":[{"data":{"title":"Pokémon GO"}}]}</script>',
      ),
    ).toThrow('serialized server data carries no shelf mapping');
  });

  it('reads the shelf mapping from a later data entry', () => {
    const html = `<script type="application/json" id="serialized-server-data">${JSON.stringify(
      {
        data: [
          { data: { title: 'Pokémon GO' } },
          { data: { shelfMapping: { appEvents: shelfOf([POGO_EVENT]) } } },
        ],
      },
    )}</script>`;

    expect(parseAppStorePage(html).appEvents).toHaveLength(1);
  });

  it('throws when the embedded data is not an object', () => {
    expect(() =>
      parseAppStorePage(
        '<script type="application/json" id="serialized-server-data">[1,2]</script>',
      ),
    ).toThrow('serialized server data carries no shelf mapping');
  });

  it('drops a video item whose url is missing or empty', () => {
    const extract = parseAppStorePage(
      pageOf({
        product_media_phone_: shelfOf([
          { $kind: 'ProductMediaItem', video: { $kind: 'Video' } },
          { $kind: 'ProductMediaItem', video: { videoUrl: '  ' } },
          { $kind: 'ProductMediaItem', video: { videoUrl: 42 } },
        ]),
      }),
    );

    expect(extract.previewVideoUrls).toEqual([]);
  });

  it('drops an app event without an id and keeps its optional fields null', () => {
    const extract = parseAppStorePage(
      pageOf({
        appEvents: shelfOf([
          { $kind: 'AppEvent', title: 'No id yet' },
          { appEventId: '6822418007' },
        ]),
      }),
    );

    expect(extract.appEvents).toEqual([
      {
        appEventId: '6822418007',
        title: null,
        kind: null,
        badge: null,
        startsAt: null,
        endsAt: null,
      },
    ]);
  });

  it('drops an app event date the store sent that is not a date', () => {
    const extract = parseAppStorePage(
      pageOf({
        appEvents: shelfOf([
          { ...POGO_EVENT, startDate: 'in November', endDate: '2026-02-30' },
        ]),
      }),
    );

    expect(extract.appEvents).toEqual([
      {
        appEventId: '6822418007',
        title: POGO_EVENT.title,
        kind: POGO_EVENT.kind,
        badge: 'happening',
        startsAt: null,
        endsAt: null,
      },
    ]);
  });

  it('keeps a featured story whose click action names no story', () => {
    const extract = parseAppStorePage(
      pageOf({
        featuredIn: shelfOf([
          storyCard(
            'TRY NOW',
            'Build a Practice',
            'https://apps.apple.com/us/app/id123',
          ),
          { heading: 'NO LINK' },
        ]),
      }),
    );

    expect(extract.featuredStories).toEqual([
      { storyId: null, heading: 'TRY NOW', title: 'Build a Practice' },
      { storyId: null, heading: 'NO LINK', title: null },
    ]);
  });

  it('drops a featured story item that carries nothing readable', () => {
    const extract = parseAppStorePage(
      pageOf({ featuredIn: shelfOf([{ $kind: 'TodayCard' }]) }),
    );

    expect(extract.featuredStories).toEqual([]);
  });

  it('answers no editors choice when the shelf carries no review', () => {
    const extract = parseAppStorePage(
      pageOf({
        editorsChoiceProductReviews: shelfOf([
          { $kind: 'ProductReview', sourceType: 'editorsChoice' },
        ]),
      }),
    );

    expect(extract.editorsChoice).toBeNull();
  });

  it('keeps a false shows badge and missing notes of an editors choice', () => {
    const extract = parseAppStorePage(
      pageOf({
        editorsChoiceProductReviews: shelfOf([
          { review: { showsBadge: false } },
        ]),
      }),
    );

    expect(extract.editorsChoice).toEqual({ showsBadge: false, notes: null });
  });

  it('answers no accessibility statement when no item carries text', () => {
    const extract = parseAppStorePage(
      pageOf({
        accessibilityHeader: shelfOf([
          { $kind: 'AccessibilityParagraph' },
          { text: { styledText: { rawText: 7 } } },
        ]),
      }),
    );

    expect(extract.accessibilityStatement).toBeNull();
  });

  it('ignores shelves whose items are not objects', () => {
    const extract = parseAppStorePage(
      pageOf({
        appEvents: 'closed',
        featuredIn: shelfOf(['a string', null, POGO_STORIES[0]]),
      }),
    );

    expect(extract.appEvents).toEqual([]);
    expect(extract.featuredStories).toHaveLength(1);
  });

  it('reads the captured similar shelf of a product page in its stored order', () => {
    const extract = parseAppStorePage(SIMILAR_PAGE_HTML);

    expect(extract.similarItems.map((item) => item.adamId)).toEqual(
      SIMILAR_SHELF_ADAM_IDS,
    );
    expect(extract.similarItems[0]).toEqual({
      adamId: '912390687',
      title: 'TREBEL Music - Download Songs',
      subtitle: 'Offline Music & AI Playlists',
      developer: 'M&M Media, Inc.',
      rating: 4.7,
      ratingCount: '188K',
      iconTemplate:
        'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/45/8f/b0/458fb0c1-ee2e-4a36-1cc2-f6fe8b86735b/Placeholder.mill/{w}x{h}{c}.{f}',
    });
  });

  it('reads the downloading shelf when the similar shelf is absent', () => {
    const extract = parseAppStorePage(
      pageOf({
        similarItemsDownloading: shelfOf([...SIMILAR_SHELF_LOCKUPS]),
      }),
    );

    expect(extract.similarItems.map((item) => item.adamId)).toEqual(
      SIMILAR_SHELF_ADAM_IDS,
    );
  });

  it('prefers the similar shelf over its downloading twin', () => {
    const extract = parseAppStorePage(
      pageOf({
        similarItems: shelfOf([
          { $kind: 'Lockup', adamId: '1', title: 'Primary' },
        ]),
        similarItemsDownloading: shelfOf([
          { $kind: 'Lockup', adamId: '2', title: 'Downloading' },
        ]),
      }),
    );

    expect(extract.similarItems.map((item) => item.adamId)).toEqual(['1']);
  });

  it('falls back to the downloading shelf when the similar shelf holds nothing usable', () => {
    const extract = parseAppStorePage(
      pageOf({
        similarItems: shelfOf([{ $kind: 'Lockup', title: 'No id' }]),
        similarItemsDownloading: shelfOf([
          { $kind: 'Lockup', adamId: '2', title: 'Downloading' },
        ]),
      }),
    );

    expect(extract.similarItems.map((item) => item.adamId)).toEqual(['2']);
  });

  it('answers no similar items when neither similar shelf is present', () => {
    const extract = parseAppStorePage(
      pageOf({
        product_media_phone_: CALM_MEDIA_SHELF,
        featuredIn: shelfOf(POGO_STORIES),
        editorsChoiceProductReviews: EDITORS_CHOICE_SHELF,
        accessibilityHeader: ACCESSIBILITY_SHELF,
      }),
    );

    expect(extract.similarItems).toEqual([]);
    expect(extract.previewVideoUrls).toEqual([]);
    expect(extract.featuredStories).toHaveLength(2);
    expect(extract.editorsChoice).not.toBeNull();
  });

  it('skips a similar item without an id or a title and keeps absent fields null', () => {
    const extract = parseAppStorePage(
      pageOf({
        similarItems: shelfOf([
          { $kind: 'Lockup', title: 'No id' },
          { $kind: 'Lockup', adamId: '   ' },
          { $kind: 'Lockup', adamId: '1' },
          { $kind: 'Lockup', adamId: '2', title: 'Partial' },
          { $kind: 'Lockup', adamId: '3', title: '  ' },
          {
            $kind: 'Lockup',
            adamId: '4',
            title: 'Odd fields',
            subtitle: 42,
            developerName: 7,
            rating: '4.8',
            ratingCount: 12000,
            icon: 'not an artwork',
          },
          'a string',
          null,
        ]),
      }),
    );

    expect(extract.similarItems).toEqual([
      {
        adamId: '2',
        title: 'Partial',
        subtitle: null,
        developer: null,
        rating: null,
        ratingCount: null,
        iconTemplate: null,
      },
      {
        adamId: '4',
        title: 'Odd fields',
        subtitle: null,
        developer: null,
        rating: null,
        ratingCount: null,
        iconTemplate: null,
      },
    ]);
  });

  it('keeps the display string of a rating count unparsed', () => {
    const extract = parseAppStorePage(SIMILAR_PAGE_HTML);

    expect(extract.similarItems.map((item) => item.ratingCount)).toEqual([
      '188K',
      '2.1M',
      '29K',
      '1.5M',
      '37K',
      '2M',
      '309K',
      '11M',
      '273',
      '69K',
    ]);
  });
});
