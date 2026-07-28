import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ClipboardCheck, LineChart, ShieldCheck, UtensilsCrossed, Wallet } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { meQuery } from "@/lib/api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mid-Day Meal Manager — School MDM & Attendance System" },
      {
        name: "description",
        content:
          "Track student attendance, mid-day meal quantities, daily expenditure, rice consumption and credits saved for your school — with Excel and PDF reports.",
      },
      { property: "og:title", content: "Mid-Day Meal Manager — School MDM & Attendance System" },
      {
        property: "og:description",
        content:
          "Attendance, meal calculations, expenditure and monthly reports for government schools, in one secure dashboard.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: ClipboardCheck,
    title: "Daily attendance",
    body: "Class-wise registers that default to present, prevent duplicate entries and stay editable.",
  },
  {
    icon: UtensilsCrossed,
    title: "Automatic meal maths",
    body: "Rice, dal and vegetable quantities computed the moment attendance is saved.",
  },
  {
    icon: Wallet,
    title: "Budget & credits",
    body: "₹6.75 per present student against real spend, with credits saved shown in green or red.",
  },
  {
    icon: LineChart,
    title: "Reports & exports",
    body: "Daily, monthly and yearly reports exportable to Excel, PDF or straight to the printer.",
  },
];

function Landing() {
  const { data: me, isLoading } = useQuery(meQuery());
  const navigate = useNavigate();

  useEffect(() => {
    if (me) navigate({ to: "/dashboard", replace: true });
  }, [me, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-3">
          <span className="brand-gradient flex size-10 items-center justify-center rounded-xl text-primary-foreground shadow-card">
            <UtensilsCrossed className="size-5" />
          </span>
          <span className="text-base font-semibold">Mid-Day Meal Manager</span>
        </div>
        <Button asChild disabled={isLoading}>
          <Link to="/auth">Sign in</Link>
        </Button>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-20">
        <section className="fade-up grid items-center gap-10 py-10 lg:grid-cols-2 lg:py-16">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
              <ShieldCheck className="size-3.5" /> Built for government schools
            </span>
            <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Run your school's mid-day meal programme without a single register.
            </h1>
            <p className="mt-4 max-w-xl text-base text-muted-foreground">
              Mark attendance in seconds, let the system calculate rice, dal and vegetables, record the
              day's expenditure and see exactly how much of the government budget you saved — every day,
              every month, every year.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/auth">
                  Open the dashboard <ArrowRight className="ml-1 size-4" />
                </Link>
              </Button>
            </div>
          </div>

          <Card className="brand-gradient border-0 p-6 text-primary-foreground shadow-float">
            <p className="text-sm/relaxed opacity-90">Example — 115 students present today</p>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {[
                { k: "Rice", v: "11.5 kg" },
                { k: "Dal", v: "2.3 kg" },
                { k: "Vegetables", v: "5.75 kg" },
              ].map((x) => (
                <div key={x.k} className="rounded-xl bg-primary-foreground/12 p-3 backdrop-blur">
                  <p className="text-xs opacity-85">{x.k}</p>
                  <p className="mt-1 text-lg font-semibold">{x.v}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-xl bg-primary-foreground/12 p-4 backdrop-blur">
              <div className="flex items-center justify-between text-sm">
                <span className="opacity-85">Government budget</span>
                <span className="font-semibold">₹776.25</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="opacity-85">Masala + fuel</span>
                <span className="font-semibold">₹253.00</span>
              </div>
            </div>
          </Card>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <Card key={f.title} className="gap-2 p-5 shadow-card">
              <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <f.icon className="size-5" />
              </span>
              <h2 className="mt-2 text-sm font-semibold">{f.title}</h2>
              <p className="text-sm text-muted-foreground">{f.body}</p>
            </Card>
          ))}
        </section>
      </main>
    </div>
  );
}
