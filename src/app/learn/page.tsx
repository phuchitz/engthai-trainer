import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { LearnScreen } from "@/components/screens/LearnScreen";

export const metadata: Metadata = { title: "Learn" };

export default function LearnPage() {
  return (
    <>
      <PageHeader titleKey="nav.learn" descriptionKey="page.learn.description" />
      <LearnScreen />
    </>
  );
}
