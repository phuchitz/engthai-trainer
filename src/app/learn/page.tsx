import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { LearnScreen } from "@/components/screens/LearnScreen";

export const metadata: Metadata = { title: "Learn" };

export default function LearnPage() {
  return (
    <>
      <PageHeader
        title="Learn"
        titleTh="เรียน"
        description="The exercise loop: prompt, answer, check, grade, next."
      />
      <LearnScreen />
    </>
  );
}
