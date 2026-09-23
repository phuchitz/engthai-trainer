import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { LessonsScreen } from "@/components/screens/LessonsScreen";

export const metadata: Metadata = { title: "Lessons" };

export default function LessonsPage() {
  return (
    <>
      <PageHeader titleKey="nav.lessons" descriptionKey="page.lessons.description" />
      <LessonsScreen />
    </>
  );
}
