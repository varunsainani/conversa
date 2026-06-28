import { requireCtx } from "@/lib/auth";
import { listPipeline } from "@/lib/data/pipeline";
import { PipelineBoard } from "./pipeline-board";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const ctx = await requireCtx();
  const initial = await listPipeline(ctx);

  return <PipelineBoard initial={initial} />;
}
