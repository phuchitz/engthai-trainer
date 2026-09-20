import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { Placeholder } from "@/components/common/Placeholder";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        titleTh="ตั้งค่า"
        description="Daily goals, answer strictness, speech, theme and the optional AI provider."
      />
      <Placeholder session={2}>
        Settings become editable once the data layer can persist them.
      </Placeholder>
    </>
  );
}
