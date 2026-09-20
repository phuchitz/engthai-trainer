import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataScreen } from "@/components/screens/DataScreen";

export const metadata: Metadata = { title: "Import / Export" };

export default function DataPage() {
  return (
    <>
      <PageHeader
        title="Import / Export"
        titleTh="นำเข้า / ส่งออก"
        description="Full JSON backups, CSV and Anki decks, with a dry-run preview before anything is written."
      />
      <DataScreen />
    </>
  );
}
