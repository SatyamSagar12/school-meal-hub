import Link from "next/link";
import { BrandMark } from "@/components/app/brand-mark";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <Link href="/" className="mb-6 flex items-center gap-2.5">
        <BrandMark className="size-9" />
        <span className="text-lg font-semibold">School Meal Hub</span>
      </Link>
      <div className="bg-card w-full max-w-sm rounded-2xl border p-6 shadow-sm">{children}</div>
      <p className="text-muted-foreground mt-6 text-xs">
        <Link href="/terms" className="underline-offset-2 hover:underline">
          Terms
        </Link>{" "}
        ·{" "}
        <Link href="/privacy" className="underline-offset-2 hover:underline">
          Privacy
        </Link>
      </p>
    </div>
  );
}
