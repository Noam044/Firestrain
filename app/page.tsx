import { AppShell } from "@/components/atlas/AppShell";
import bdiffAnnualJson from "@/public/data/bdiff/annuel.json";
import effisIndexJson from "@/public/data/effis/index.json";
import { BdiffAnnualSchema, EffisIndexSchema } from "@/lib/data/schemas";

// The year strip and the totals ship with the page: they are on screen before any data request.
const initialData = {
  effisIndex: EffisIndexSchema.parse(effisIndexJson),
  bdiffAnnual: BdiffAnnualSchema.parse(bdiffAnnualJson),
};

export default function MapPage() {
  return <AppShell initialData={initialData} />;
}
