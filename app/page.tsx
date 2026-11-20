import { AppShell } from "@/components/tracker/AppShell";
import bdiffAnnualJson from "@/public/data/bdiff/annuel.json";
import effisIndexJson from "@/public/data/effis/index.json";
import { BdiffAnnualSchema, EffisIndexSchema } from "@/lib/data/schemas";

// The archive index and the BDIFF totals ship with the page: no request before the fires themselves.
const initialData = {
  effisIndex: EffisIndexSchema.parse(effisIndexJson),
  bdiffAnnual: BdiffAnnualSchema.parse(bdiffAnnualJson),
};

export default function MapPage() {
  return <AppShell initialData={initialData} />;
}
