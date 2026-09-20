import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { VocabularyScreen } from "@/components/screens/VocabularyScreen";

export const metadata: Metadata = { title: "Vocabulary" };

export default function VocabularyPage() {
  return (
    <>
      <PageHeader
        title="Vocabulary"
        titleTh="คำศัพท์"
        description="Search, filter and suspend individual words, each with its own schedule."
      />
      <VocabularyScreen />
    </>
  );
}
