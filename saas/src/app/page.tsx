import Link from "next/link";
import { CheckCircle2, ClipboardCheck, FileSpreadsheet, IndianRupee, Smartphone, Users, Wheat } from "lucide-react";
import { BrandMark } from "@/components/app/brand-mark";
import { Button } from "@/components/ui/button";
import { formatMoney, perMonthLabel, PLAN, TRIAL_DAYS } from "@/lib/plans";
import { LEGAL_LINKS } from "@/components/marketing/legal-page";

const FEATURES = [
  { icon: ClipboardCheck, title: "Attendance in a minute", body: "Type one head count per class, or tick children one by one. Both work, and the day's total is always right." },
  { icon: Wheat, title: "Rice, dal and vegetables worked out", body: "Primary and upper-primary norms applied class by class: 10 + 10 children need 10×100 g + 10×150 g of rice, not 20×100." },
  { icon: IndianRupee, title: "Cost against budget, every day", body: "Enter today's dal and vegetable prices. Masala, fuel, total spend, budget and savings follow on their own." },
  { icon: FileSpreadsheet, title: "Monthly reports, ready to submit", body: "Daily, monthly or any range — for primary, upper primary or the whole school — in Excel or PDF." },
  { icon: Users, title: "The whole staff room", body: `Up to ${PLAN.maxUsers} teacher logins per school, with a log of who saved what.` },
  { icon: Smartphone, title: "Made for the phone", body: "Works on any Android browser and installs to the home screen. No app store needed." },
];

const FAQ = [
  ["Is our data safe?", "Each school's records are kept separate and only its own teachers can sign in. Data is stored on Cloudflare's network; we never sell or share it."],
  ["What happens after the free trial?", `Pay ${formatMoney(PLAN.priceMinor)} for the year by UPI. If you don't, the register locks after a short grace period — nothing is deleted, and paying opens it again exactly as it was.`],
  ["Does it renew automatically?", "No. Nothing is charged without you paying. We remind you before the year ends."],
  ["Can I change the meal norms?", "Yes. Grams and rupee rates per child are set per school, separately for primary and upper primary, and can be changed for a single class too."],
  ["We already have students in Excel.", "Download the template, paste your list in, and import it. Hundreds of students take a few seconds."],
];

export default function Home() {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <BrandMark className="size-9" />
          <span className="text-lg font-semibold">School Meal Hub</span>
        </Link>
        <nav className="flex items-center gap-2">
          <Button variant="ghost" nativeButton={false} render={<Link href="/login" />}>
            Sign in
          </Button>
          <Button nativeButton={false} render={<Link href="/signup" />}>
            Start free
          </Button>
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-4 pt-10 pb-16 sm:px-8 sm:pt-16">
        <p className="eyebrow text-bronze">PM POSHAN · Mid-day meal register</p>
        <h1 className="mt-4 max-w-3xl text-[2.5rem] text-balance sm:text-[3.5rem]">
          The mid-day meal register, done before the bell.
        </h1>
        <p className="text-muted-foreground mt-5 max-w-2xl text-lg">
          For government school teachers: attendance, rice and dal quantities, daily cost against budget, and the monthly report — on your phone, without the
          register book or the calculator.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button size="lg" nativeButton={false} render={<Link href="/signup" />}>
            Try it free for {TRIAL_DAYS} days
          </Button>
          <Button size="lg" variant="outline" nativeButton={false} render={<a href="#pricing" />}>
            {formatMoney(PLAN.priceMinor)} a year
          </Button>
        </div>
      </section>

      <section className="bg-card border-y">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:grid-cols-2 sm:px-8 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title}>
              <Icon className="text-bronze size-6" aria-hidden />
              <h2 className="mt-3 text-base font-semibold">{title}</h2>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-6xl px-4 py-16 sm:px-8">
        <h2 className="text-center text-3xl font-semibold tracking-tight">One simple price</h2>
        <p className="text-muted-foreground mt-2 text-center">Per school, for the whole year. Less than one plate of samosas a week.</p>
        <div className="bg-card mx-auto mt-8 max-w-md rounded-2xl border p-8 shadow-sm">
          <p className="eyebrow text-bronze">{PLAN.name}</p>
          <p className="mt-2 text-5xl font-semibold tracking-tight">
            {formatMoney(PLAN.priceMinor)}
            <span className="text-muted-foreground text-lg font-normal"> / year</span>
          </p>
          <p className="text-muted-foreground mt-1 text-sm">About {perMonthLabel()}. Pay by UPI. No auto-renewal.</p>
          <ul className="mt-6 grid gap-2 text-sm">
            {PLAN.features.map((f) => (
              <li key={f} className="flex gap-2">
                <CheckCircle2 className="text-success size-4 shrink-0 translate-y-0.5" aria-hidden /> {f}
              </li>
            ))}
          </ul>
          <Button size="lg" className="mt-7 w-full" nativeButton={false} render={<Link href="/signup" />}>
            Start {TRIAL_DAYS}-day free trial
          </Button>
        </div>
      </section>

      <section className="bg-card border-y">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-8">
          <h2 className="text-2xl font-semibold tracking-tight">Questions</h2>
          <dl className="mt-6 grid gap-5">
            {FAQ.map(([q, a]) => (
              <div key={q}>
                <dt className="font-medium">{q}</dt>
                <dd className="text-muted-foreground mt-1 text-sm leading-relaxed">{a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <footer className="text-muted-foreground mx-auto flex max-w-6xl flex-wrap justify-between gap-4 px-4 py-8 text-sm sm:px-8">
        <span>© {new Date().getFullYear()} School Meal Hub</span>
        <nav className="flex gap-4">
          {LEGAL_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-foreground">
              {l.label}
            </Link>
          ))}
        </nav>
      </footer>
    </div>
  );
}
