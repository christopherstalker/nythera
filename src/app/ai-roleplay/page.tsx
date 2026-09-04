import { SeoLandingPage } from "@/components/seo/seo-landing-page";
import { createLandingMetadata, SEO_LANDINGS } from "@/lib/seo-landing-content";

const content = SEO_LANDINGS.aiRoleplay;

export const revalidate = 60;
export const metadata = createLandingMetadata(content);

export default function AiRoleplayPage() {
  return <SeoLandingPage content={content} />;
}
