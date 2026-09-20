import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { LessonsScreen } from "@/components/screens/LessonsScreen";

export const metadata: Metadata = { title: "Lessons" };

export default function LessonsPage() {
  return (
    <>
      <PageHeader
        title="Lessons"
        titleTh="บทเรียน"
        description="Browse lesson decks by level and start a study session."
      />
      <LessonsScreen />
    </>
  );
}
