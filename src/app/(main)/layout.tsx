import { AuthGuard } from "@/components/auth/auth-guard";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
