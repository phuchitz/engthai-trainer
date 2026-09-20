import { PageHeader } from "@/components/layout/PageHeader";
import { DashboardScreen } from "@/components/screens/DashboardScreen";

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        titleTh="ภาพรวม"
        description="Streak, daily goal, accuracy trend and the review heatmap."
      />
      <DashboardScreen />
    </>
  );
}
