import { PageHeader } from "@/components/layout/PageHeader";
import { DashboardScreen } from "@/components/screens/DashboardScreen";

export default function DashboardPage() {
  return (
    <>
      <PageHeader titleKey="nav.dashboard" descriptionKey="page.dashboard.description" />
      <DashboardScreen />
    </>
  );
}
