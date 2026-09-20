import { PageHeader } from "@/components/layout/PageHeader";
import { Placeholder } from "@/components/common/Placeholder";

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        titleTh="ภาพรวม"
        description="Streak, daily goal, accuracy trend and the review heatmap."
      />
      <Placeholder session={8}>
        Every figure here is derived from the append-only attempt log, so nothing needs a stored counter.
      </Placeholder>
    </>
  );
}
