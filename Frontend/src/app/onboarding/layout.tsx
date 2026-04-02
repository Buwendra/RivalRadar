import { Logo } from "@/components/shared/logo";
import Link from "next/link";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-brand-950">
      <header className="flex h-16 items-center justify-center border-b border-brand-700">
        <Link href="/">
          <Logo />
        </Link>
      </header>
      <main className="flex flex-1 flex-col items-center px-4 py-8">
        <div className="w-full max-w-2xl">{children}</div>
      </main>
    </div>
  );
}
