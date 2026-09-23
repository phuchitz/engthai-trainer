import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { VocabularyScreen } from "@/components/screens/VocabularyScreen";

export const metadata: Metadata = { title: "Vocabulary" };

export default function VocabularyPage() {
  return (
    <>
      <PageHeader titleKey="nav.vocabulary" descriptionKey="page.vocabulary.description" />
      <VocabularyScreen />
    </>
  );
}
