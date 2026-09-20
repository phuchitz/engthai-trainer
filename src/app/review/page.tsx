import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { ReviewScreen } from "@/components/screens/ReviewScreen";

export const metadata: Metadata = { title: "Review" };

export default function ReviewPage() {
  return (
    <>
      <PageHeader
        title="Review"
        titleTh="ทบทวน"
        description="Everything the scheduler says is due today, in one mixed queue."
      />
      <ReviewScreen />
    </>
  );
}
