import { batchEmailElement } from '../../alerts/email-format';
import {
  appDelisted,
  listingBatch,
  listingSection,
  rival,
} from '../../alerts/listing-events.fixture';
import { withPreviewIcons } from './preview-icons';
import { PREVIEW_ALERT_CONTEXT } from './preview-origin';

const gone = appDelisted({ app: rival });

export default function CompetitorWatchAvailabilityPreview() {
  return batchEmailElement(
    withPreviewIcons({
      ...listingBatch(
        listingSection({
          competitors: [
            {
              app: {
                id: rival.id,
                name: rival.name,
                store: 'APP_STORE',
                country: 'us',
              },
              changes: [],
              availability: [gone],
            },
          ],
        }),
        [gone],
      ),
      scope: 'competitors',
    }),
    PREVIEW_ALERT_CONTEXT,
  );
}
