import { SeoLandingPage } from "@/components/seo/seo-landing-page";
import { createLandingMetadata, SEO_LANDINGS } from "@/lib/seo-landing-content";

const content = SEO_LANDINGS.roleplayCharacters;

export const revalidate = 60;
export const metadata = createLandingMetadata(content);

export default function RoleplayCharactersPage() {
  return <SeoLandingPage content={content} />;
}
