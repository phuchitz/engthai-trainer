import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { Placeholder } from "@/components/common/Placeholder";

export const metadata: Metadata = { title: "Lessons" };

export default function LessonsPage() {
  return (
    <>
      <PageHeader
        title="Lessons"
        titleTh="บทเรียน"
        description="Browse lesson decks by level and start a study session."
      />
      <Placeholder session={2}>
        Lesson decks arrive with the data layer; starting a session from here lands in session 5.
      </Placeholder>
    </>
  );
}
