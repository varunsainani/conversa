import { analyticsOverviewAction } from "@/app/(app)/actions";
import { AnalyticsClient } from "./analytics-client";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const data = await analyticsOverviewAction();
  return <AnalyticsClient data={data} />;
}
