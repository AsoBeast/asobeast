import { batchEmailElement } from '../../alerts/email-format';
import {
  listingBatch,
  listingSection,
  ratingDropped,
  reviewSpike,
} from '../../alerts/listing-events.fixture';
import { withPreviewIcons } from './preview-icons';
import { PREVIEW_ALERT_CONTEXT } from './preview-origin';

const drop = ratingDropped({ version: '2.4' });
const spike = reviewSpike();

export default function DailyAppUpdateListingEventsPreview() {
  return batchEmailElement(
    withPreviewIcons(
      listingBatch(
        listingSection({ ratingDrops: [drop], reviewSpikes: [spike] }),
        [drop, spike],
      ),
    ),
    PREVIEW_ALERT_CONTEXT,
  );
}
