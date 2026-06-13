export const PLATFORM_ADMIN_EMAIL = "chrisstalker@gmail.com";

export function isPlatformAdminEmail(email?: string | null) {
  return email?.toLowerCase() === PLATFORM_ADMIN_EMAIL;
}
