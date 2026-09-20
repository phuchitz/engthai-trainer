import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { Placeholder } from "@/components/common/Placeholder";

export const metadata: Metadata = { title: "Review" };

export default function ReviewPage() {
  return (
    <>
      <PageHeader
        title="Review"
        titleTh="ทบทวน"
        description="Everything the scheduler says is due today, in one mixed queue."
      />
      <Placeholder session={7}>
        Due-queue building lands with the scheduler in session 4; the screen itself in session 7.
      </Placeholder>
    </>
  );
}
