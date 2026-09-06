import { StoryAppearanceSettings } from "@/components/settings/story-appearance-settings";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ chatId?: string }> }) {
  const { chatId } = await searchParams;
  return <StoryAppearanceSettings key={chatId || "defaults"} chatId={chatId} section="reading" />;
}
