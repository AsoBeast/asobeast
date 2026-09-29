import { describe, expect, it } from 'vitest';

import { releaseNotesText } from './release-notes';

describe('releaseNotesText', () => {
  it('turns every line break tag spelling into a line', () => {
    expect(
      releaseNotesText('v4.6862<br>- New stickers<br/>- New memes:<BR />✓ Old'),
    ).toBe('v4.6862\n- New stickers\n- New memes:\n✓ Old');
  });

  it('turns a line break tag with attributes into a line', () => {
    expect(
      releaseNotesText('New<br class="note">features<br data-x=1/>here'),
    ).toBe('New\nfeatures\nhere');
  });

  it('strips tags that only start like a line break', () => {
    expect(releaseNotesText('<brand>Fixes</brand>')).toBe('Fixes');
  });

  it('normalizes carriage returns to lines', () => {
    expect(releaseNotesText('One\r\nTwo\rThree')).toBe('One\nTwo\nThree');
  });

  it('drops other markup', () => {
    expect(releaseNotesText('<b>Fixes</b> for <a href="x">links</a>')).toBe(
      'Fixes for links',
    );
  });

  it('strips markup that a single pass would reassemble', () => {
    expect(releaseNotesText('<<b>b>Bold</b>')).toBe('Bold');
    expect(releaseNotesText('<<script>script>alert(1)<</script>/script>')).toBe(
      'alert(1)',
    );
  });

  it('keeps angle brackets that are not markup', () => {
    expect(releaseNotesText('We <3 you, 2 < 3 > 1')).toBe(
      'We <3 you, 2 < 3 > 1',
    );
  });

  it('decodes named, decimal and hex entities', () => {
    expect(
      releaseNotesText('Fixes &amp; speed&#33; &quot;Pro&#x22; &LT;3&nbsp;'),
    ).toBe('Fixes & speed! "Pro" <3');
  });

  it('leaves unknown and out of range entities as written', () => {
    expect(releaseNotesText('&copy; &#99999999; &#xD800; &#0;')).toBe(
      '&copy; &#99999999; &#xD800; &#0;',
    );
  });

  it('keeps escaped markup as text', () => {
    expect(releaseNotesText('Type &lt;br&gt; to wrap')).toBe(
      'Type <br> to wrap',
    );
  });

  it('trims lines and drops blank ones', () => {
    expect(releaseNotesText('  One <br><br>  <br>Two<br>')).toBe('One\nTwo');
  });

  it('drops a tag cut off by truncation and keeps the ellipsis', () => {
    expect(releaseNotesText('Fixes<br>- New stickers<b…')).toBe(
      'Fixes\n- New stickers…',
    );
    expect(releaseNotesText('Fixes<br>- Faster sync</b')).toBe(
      'Fixes\n- Faster sync',
    );
    expect(releaseNotesText('We <3 you…')).toBe('We <3 you…');
  });

  it('returns an empty string for markup alone', () => {
    expect(releaseNotesText('<br> <br/>')).toBe('');
  });

  it('leaves plain multi-line notes unchanged', () => {
    const notes = 'Bug fixes\n- Faster sync\n- New widgets';
    expect(releaseNotesText(notes)).toBe(notes);
  });
});
