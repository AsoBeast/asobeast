describe('review.new alerts (e2e)', () => {
  it.todo('sends every star of a sync to a channel without a filter');
  it.todo('sends only the picked stars to a channel with a filter');
  it.todo('sends a negative channel only the negative review');
  it.todo('sends a channel holding both events each review once');
  it.todo('sends the negative reviews of the stars a channel left out');
  it.todo('mails an email alert only its picked stars');
  it.todo('collects nothing for a second sync of the same reviews');
  it.todo('collects nothing for the backfill of an import');
  it.todo('collects no new review without a subscriber');
});
