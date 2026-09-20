import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { Placeholder } from "@/components/common/Placeholder";

export const metadata: Metadata = { title: "Import / Export" };

export default function DataPage() {
  return (
    <>
      <PageHeader
        title="Import / Export"
        titleTh="นำเข้า / ส่งออก"
        description="Full JSON backups, CSV and Anki decks, with a dry-run preview before anything is written."
      />
      <Placeholder session={9}>
        Your data lives only in this browser, so the backup file is the only copy that survives a cleared profile.
      </Placeholder>
    </>
  );
}
