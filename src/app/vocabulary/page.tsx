import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { Placeholder } from "@/components/common/Placeholder";

export const metadata: Metadata = { title: "Vocabulary" };

export default function VocabularyPage() {
  return (
    <>
      <PageHeader
        title="Vocabulary"
        titleTh="คำศัพท์"
        description="Search, filter and suspend individual words, each with its own schedule."
      />
      <Placeholder session={7}>
        Vocabulary carries SRS state independent of the sentences it appears in.
      </Placeholder>
    </>
  );
}
