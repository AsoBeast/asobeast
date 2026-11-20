export interface SimilarShelfLockup {
  $kind: 'Lockup';
  adamId: string;
  title: string;
  subtitle: string;
  developerName: string;
  rating: number;
  ratingCount: string;
  icon: { $kind: 'Artwork'; template: string };
}

export const SIMILAR_SHELF_LOCKUPS: SimilarShelfLockup[] = [
  {
    $kind: 'Lockup',
    adamId: '912390687',
    title: 'TREBEL Music - Download Songs',
    subtitle: 'Offline Music & AI Playlists',
    developerName: 'M&M Media, Inc.',
    rating: 4.7,
    ratingCount: '188K',
    icon: {
      $kind: 'Artwork',
      template:
        'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/45/8f/b0/458fb0c1-ee2e-4a36-1cc2-f6fe8b86735b/Placeholder.mill/{w}x{h}{c}.{f}',
    },
  },
  {
    $kind: 'Lockup',
    adamId: '336353151',
    title: 'SoundCloud: Discover New Music',
    subtitle: 'New sounds before they blow up',
    developerName: 'SoundCloud Global Limited & Co KG',
    rating: 4.8,
    ratingCount: '2.1M',
    icon: {
      $kind: 'Artwork',
      template:
        'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/6c/f3/18/6cf31828-c9db-f95b-cc66-c5e620ebc86f/Placeholder.mill/{w}x{h}{c}.{f}',
    },
  },
  {
    $kind: 'Lockup',
    adamId: '1447312762',
    title: 'Music Downloader / MP3 Player',
    subtitle: 'Music Player, Download Songs',
    developerName: 'Aktis Inc',
    rating: 4.3,
    ratingCount: '29K',
    icon: {
      $kind: 'Artwork',
      template:
        'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource221/v4/eb/2c/23/eb2c23c9-7b58-c194-929b-7c869817c719/Placeholder.mill/{w}x{h}{c}.{f}',
    },
  },
  {
    $kind: 'Lockup',
    adamId: '1017492454',
    title: 'YouTube Music',
    subtitle: '300M tracks, covers, & remixes',
    developerName: 'Google',
    rating: 4.8,
    ratingCount: '1.5M',
    icon: {
      $kind: 'Artwork',
      template:
        'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource221/v4/da/ce/15/dace1576-4aa2-a641-8bd6-a227ec519e9b/Placeholder.mill/{w}x{h}{c}.{f}',
    },
  },
  {
    $kind: 'Lockup',
    adamId: '292738169',
    title: 'Deezer: Music Player, Podcast',
    subtitle: 'Download, stream songs offline',
    developerName: 'DEEZER SA',
    rating: 4.7,
    ratingCount: '37K',
    icon: {
      $kind: 'Artwork',
      template:
        'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource221/v4/7a/47/b6/7a47b655-1174-5dc8-cbcf-35dd42994314/Placeholder.mill/{w}x{h}{c}.{f}',
    },
  },
  {
    $kind: 'Lockup',
    adamId: '921765888',
    title: 'Audiomack - Play Music Offline',
    subtitle: 'Stream music & songs offline',
    developerName: 'Audiomack, Inc.',
    rating: 4.8,
    ratingCount: '2M',
    icon: {
      $kind: 'Artwork',
      template:
        'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/48/a2/59/48a259ba-12b0-ba6f-faa8-e059bfefe5d5/Placeholder.mill/{w}x{h}{c}.{f}',
    },
  },
  {
    $kind: 'Lockup',
    adamId: '1139055265',
    title: 'Trending Music Player',
    subtitle: 'AI DJ, Cloud, Video, & Lyrics',
    developerName: 'Trending.fm Inc.',
    rating: 4.6,
    ratingCount: '309K',
    icon: {
      $kind: 'Artwork',
      template:
        'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource221/v4/0f/88/9f/0f889fee-1faa-829a-aa32-241b46742561/Placeholder.mill/{w}x{h}{c}.{f}',
    },
  },
  {
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
  },
  {
    $kind: 'Lockup',
    adamId: '497345210',
    title: 'Palco MP3: Music and podcasts',
    subtitle: 'Listen to and download music',
    developerName: 'Studio Sol Comunicacao Digital LTDA',
    rating: 4.8,
    ratingCount: '273',
    icon: {
      $kind: 'Artwork',
      template:
        'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource221/v4/f0/e3/d2/f0e3d243-efbb-f920-ac1a-130748f1a8db/Placeholder.mill/{w}x{h}{c}.{f}',
    },
  },
  {
    $kind: 'Lockup',
    adamId: '1404011371',
    title: 'Music Player ‣',
    subtitle: 'Stream songs & offline music',
    developerName: 'Companjen Apps B.V.',
    rating: 4.6,
    ratingCount: '69K',
    icon: {
      $kind: 'Artwork',
      template:
        'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource221/v4/c6/d0/8c/c6d08c0b-c486-c3d2-c0c4-c544e1f80fcf/Placeholder.mill/{w}x{h}{c}.{f}',
    },
  },
];

export const SIMILAR_SHELF_ADAM_IDS = SIMILAR_SHELF_LOCKUPS.map(
  ({ adamId }) => adamId,
);

export interface MoreByApp {
  adamId: string;
  title: string;
  href: string;
}

export const MORE_BY_APPS: MoreByApp[] = [
  {
    adamId: '1056182234',
    title: 'Spotify for Creators',
    href: 'https://apps.apple.com/us/app/spotify-for-creators/id1056182234',
  },
  {
    adamId: '1222021797',
    title: 'Spotify for Artists',
    href: 'https://apps.apple.com/us/app/spotify-for-artists/id1222021797',
  },
  {
    adamId: '1470209570',
    title: 'Spotify Kids',
    href: 'https://apps.apple.com/us/app/spotify-kids/id1470209570',
  },
];

const similarShelf = (): Record<string, unknown> => ({
  $kind: 'Shelf',
  contentType: 'smallLockup',
  marker: null,
  items: SIMILAR_SHELF_LOCKUPS,
});

const serializedServerData = (shelves: Record<string, unknown>): string =>
  `<script type="application/json" id="serialized-server-data">${JSON.stringify(
    { data: [{ data: { shelfMapping: shelves } }] },
  )}</script>`;

export const SIMILAR_PAGE_HTML = `<h1>Spotify - Music and Podcasts</h1>${MORE_BY_APPS.map(
  ({ href }) => `<a href="${href}">More by Spotify</a>`,
).join('')}${serializedServerData({
  similarItems: similarShelf(),
  similarItemsDownloading: similarShelf(),
})}`;
