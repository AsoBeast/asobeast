import { batchEmailElement } from '../../alerts/email-format';
import {
  appDelisted,
  appUnlistedMarket,
  listingBatch,
  listingSection,
  ratingDropped,
  reviewSpike,
} from '../../alerts/listing-events.fixture';
import { withPreviewIcons } from './preview-icons';
import { PREVIEW_ALERT_CONTEXT } from './preview-origin';

const drop = ratingDropped({ version: '2.4' });
const spike = reviewSpike();
const delisted = appDelisted();
const unlisted = appUnlistedMarket();

export default function DailyAppUpdateListingEventsPreview() {
  return batchEmailElement(
    withPreviewIcons(
      listingBatch(
        listingSection({
          availability: [delisted, unlisted],
          ratingDrops: [drop],
          reviewSpikes: [spike],
        }),
        [delisted, unlisted, drop, spike],
      ),
    ),
    PREVIEW_ALERT_CONTEXT,
  );
}
