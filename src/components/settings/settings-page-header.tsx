import type { LucideIcon } from "lucide-react";

export function SettingsPageHeader({
  icon: Icon,
  title,
  description
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <header className="studio-section-heading">
      <Icon className="h-5 w-5" aria-hidden />
      <h2>{title}</h2>
      <p>{description}</p>
    </header>
  );
}
