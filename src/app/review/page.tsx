import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { ReviewScreen } from "@/components/screens/ReviewScreen";

export const metadata: Metadata = { title: "Review" };

export default function ReviewPage() {
  return (
    <>
      <PageHeader titleKey="nav.review" descriptionKey="page.review.description" />
      <ReviewScreen />
    </>
  );
}
