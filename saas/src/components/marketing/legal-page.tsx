import Link from "next/link";
import { BrandMark } from "@/components/app/brand-mark";

export const LEGAL_LINKS = [
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/refund", label: "Refunds" },
  { href: "/contact", label: "Contact" },
];

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-8">
      <Link href="/" className="mb-10 flex items-center gap-2.5">
        <BrandMark className="size-8" />
        <span className="font-semibold">School Meal Hub</span>
      </Link>
      <h1 className="text-4xl">{title}</h1>
      <p className="text-muted-foreground mt-2 text-sm">Last updated {updated}</p>
      <div className="mt-8 grid gap-4 text-[0.9375rem] leading-relaxed [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:pl-5">{children}</div>
      <nav className="text-muted-foreground mt-12 flex gap-4 border-t pt-6 text-sm">
        {LEGAL_LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="hover:text-foreground">
            {l.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
