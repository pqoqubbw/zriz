import { OpenPanelComponent } from "@openpanel/nextjs";

import { ANALYTICS_ON, OPENPANEL_CLIENT_ID } from "@/lib/analytics";

const Analytics = () =>
  ANALYTICS_ON ? (
    <OpenPanelComponent
      apiUrl="/api/op"
      clientId={OPENPANEL_CLIENT_ID}
      scriptUrl="/api/op/op1.js"
      trackOutgoingLinks
      trackScreenViews
    />
  ) : null;

export { Analytics };
