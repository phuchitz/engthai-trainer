import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { SettingsScreen } from "@/components/screens/SettingsScreen";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader titleKey="nav.settings" descriptionKey="page.settings.description" />
      <SettingsScreen />
    </>
  );
}
