import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataScreen } from "@/components/screens/DataScreen";

export const metadata: Metadata = { title: "Import / Export" };

export default function DataPage() {
  return (
    <>
      <PageHeader titleKey="nav.data" descriptionKey="page.data.description" />
      <DataScreen />
    </>
  );
}
