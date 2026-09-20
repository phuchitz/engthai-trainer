import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { Placeholder } from "@/components/common/Placeholder";

export const metadata: Metadata = { title: "Learn" };

export default function LearnPage() {
  return (
    <>
      <PageHeader
        title="Learn"
        titleTh="เรียน"
        description="The exercise loop: prompt, answer, check, grade, next."
      />
      <Placeholder session={5}>
        The core learning flow is built once the answer engine and scheduler are proven.
      </Placeholder>
    </>
  );
}
