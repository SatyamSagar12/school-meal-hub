import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Save, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  auditQuery,
  classListQuery,
  classRatesQuery,
  deleteClassRate,
  logAudit,
  meQuery,
  settingsQuery,
  updateSettings,
  upsertClassRate,
} from "@/lib/api";
import {
  DEFAULT_SETTINGS,
  inr,
  prettyDate,
  tierForClass,
  TIER_LABEL,
  TIERS,
  toRates,
  type Tier,
} from "@/lib/mdm";
import { settingsSchema, type SettingsFormValues } from "@/lib/schemas";

/** Base rate field names, shared by both tiers. */
type TierFieldBase =
  | "rice_per_student_g"
  | "dal_per_student_g"
  | "veg_per_student_g"
  | "budget_per_student"
  | "masala_per_student"
  | "fuel_per_student";

/** Primary keeps the unsuffixed column names; upper primary is `*_upper`. */
function tierField(tier: Tier, base: TierFieldBase): keyof SettingsFormValues {
  return (tier === "upper_primary" ? `${base}_upper` : base) as keyof SettingsFormValues;
}

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Mid-Day Meal Manager" },
      {
        name: "description",
        content:
          "Configure school details, academic year, per-student meal quantities, budget and cost rates.",
      },
      { property: "og:title", content: "Settings — Mid-Day Meal Manager" },
      {
        property: "og:description",
        content: "School profile and mid-day meal rate configuration.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const { data: me } = useQuery(meQuery());
  const { data: settings } = useQuery(settingsQuery());
  const { data: audit } = useQuery(auditQuery());
  const { data: lists } = useQuery(classListQuery());
  const { data: classRates } = useQuery(classRatesQuery());

  // Per-class override inputs, keyed by class name. Blank = use the default.
  const [rateInputs, setRateInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!lists) return;
    const next: Record<string, string> = {};
    for (const c of lists.classes) {
      const override = (classRates ?? []).find((r) => r.class_name === c && r.section === "");
      next[c] = override ? String(Number(override.budget_per_student)) : "";
    }
    setRateInputs(next);
  }, [lists, classRates]);

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      school_name: "",
      academic_year: "",
      ...DEFAULT_SETTINGS.primary,
      rice_per_student_g_upper: DEFAULT_SETTINGS.upper_primary.rice_per_student_g,
      dal_per_student_g_upper: DEFAULT_SETTINGS.upper_primary.dal_per_student_g,
      veg_per_student_g_upper: DEFAULT_SETTINGS.upper_primary.veg_per_student_g,
      budget_per_student_upper: DEFAULT_SETTINGS.upper_primary.budget_per_student,
      masala_per_student_upper: DEFAULT_SETTINGS.upper_primary.masala_per_student,
      fuel_per_student_upper: DEFAULT_SETTINGS.upper_primary.fuel_per_student,
    },
  });

  useEffect(() => {
    if (!settings) return;
    form.reset({
      school_name: settings.school_name,
      academic_year: settings.academic_year,
      rice_per_student_g: settings.rice_per_student_g,
      dal_per_student_g: settings.dal_per_student_g,
      veg_per_student_g: settings.veg_per_student_g,
      budget_per_student: settings.budget_per_student,
      masala_per_student: settings.masala_per_student,
      fuel_per_student: settings.fuel_per_student,
      rice_per_student_g_upper: settings.rice_per_student_g_upper,
      dal_per_student_g_upper: settings.dal_per_student_g_upper,
      veg_per_student_g_upper: settings.veg_per_student_g_upper,
      budget_per_student_upper: settings.budget_per_student_upper,
      masala_per_student_upper: settings.masala_per_student_upper,
      fuel_per_student_upper: settings.fuel_per_student_upper,
    });
  }, [settings, form]);

  const save = useMutation({
    mutationFn: async (v: SettingsFormValues) => {
      await updateSettings({
        school_name: String(v.school_name),
        academic_year: String(v.academic_year),
        rice_per_student_g: Number(v.rice_per_student_g),
        dal_per_student_g: Number(v.dal_per_student_g),
        veg_per_student_g: Number(v.veg_per_student_g),
        budget_per_student: Number(v.budget_per_student),
        masala_per_student: Number(v.masala_per_student),
        fuel_per_student: Number(v.fuel_per_student),
        rice_per_student_g_upper: Number(v.rice_per_student_g_upper),
        dal_per_student_g_upper: Number(v.dal_per_student_g_upper),
        veg_per_student_g_upper: Number(v.veg_per_student_g_upper),
        budget_per_student_upper: Number(v.budget_per_student_upper),
        masala_per_student_upper: Number(v.masala_per_student_upper),
        fuel_per_student_upper: Number(v.fuel_per_student_upper),
      });
      await logAudit("update", "settings", undefined, { school_name: v.school_name });
    },
    onSuccess: () => {
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveRates = useMutation({
    mutationFn: async () => {
      for (const [className, raw] of Object.entries(rateInputs)) {
        const value = raw.trim();
        if (value === "") {
          // Cleared input means "fall back to the school-wide rate".
          await deleteClassRate(className, "");
          continue;
        }
        const n = Number(value);
        if (!Number.isFinite(n) || n < 0) {
          throw new Error(`Class ${className}: enter a valid rate`);
        }
        await upsertClassRate(className, "", n);
      }
      await logAudit("update", "class_rates", undefined, {
        classes: Object.keys(rateInputs).length,
      });
    },
    onSuccess: () => {
      toast.success("Class budget rates saved");
      qc.invalidateQueries({ queryKey: ["classRates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const numberField = (
    name: keyof SettingsFormValues,
    label: string,
    description: string,
    step = "1",
  ) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input type="number" step={step} min="0" {...field} />
          </FormControl>
          <FormDescription>{description}</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  return (
    <>
      <PageHeader
        title="Settings"
        description="School profile and mid-day meal calculation rates"
        actions={
          me?.isAdmin ? (
            <Badge variant="secondary">
              <ShieldCheck className="mr-1 size-3.5" /> Administrator
            </Badge>
          ) : (
            <Badge variant="outline">Staff access</Badge>
          )
        }
      />

      <Form {...form}>
        <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="grid gap-4">
          <Card className="p-5">
            <h2 className="text-sm font-semibold">School profile</h2>
            <p className="mb-3 text-xs text-muted-foreground">Appears on every exported report.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="school_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>School name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="academic_year"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Academic year</FormLabel>
                    <FormControl>
                      <Input placeholder="2025-2026" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold">Class-wise meal quantities and rates</h2>
            <p className="mb-4 text-xs text-muted-foreground">
              Classes 6, 7 and 8 use the upper primary rates; every other class — including
              pre-primary names such as LKG — uses the primary rates. Quantities drive the daily
              rice, dal and vegetable requirement; the rupee rates drive expenditure and credits
              saved.
            </p>
            <div className="grid gap-6 lg:grid-cols-2">
              {TIERS.map((tier) => (
                <div key={tier}>
                  <h3 className="mb-3 text-sm font-medium">{TIER_LABEL[tier]}</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {numberField(
                      tierField(tier, "rice_per_student_g"),
                      "Rice (grams)",
                      "Government supply — quantity only, no cost",
                    )}
                    {numberField(
                      tierField(tier, "dal_per_student_g"),
                      "Dal (grams)",
                      "Costed at the daily dal rate",
                    )}
                    {numberField(
                      tierField(tier, "veg_per_student_g"),
                      "Vegetables (grams)",
                      "Costed at the daily vegetable rate",
                    )}
                    {numberField(
                      tierField(tier, "budget_per_student"),
                      "Budget (₹)",
                      "Sanctioned cooking cost per meal, unless a class overrides it below",
                      "0.01",
                    )}
                    {numberField(
                      tierField(tier, "masala_per_student"),
                      "Masala (₹)",
                      "Fixed condiment cost per meal",
                      "0.01",
                    )}
                    {numberField(
                      tierField(tier, "fuel_per_student"),
                      "Fuel (₹)",
                      "Fixed cooking fuel cost per meal",
                      "0.01",
                    )}
                  </div>
                </div>
              ))}
            </div>
            <Separator className="my-4" />
            <Button type="submit" disabled={save.isPending} className="w-full sm:w-auto">
              <Save className="mr-1.5 size-4" /> {save.isPending ? "Saving…" : "Save settings"}
            </Button>
          </Card>
        </form>
      </Form>

      <Card className="mt-4 p-5">
        <h2 className="text-sm font-semibold">Per-class budget override</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Optional. Overrides the sanctioned cooking cost for one class, taking precedence over its
          tier rate above. Leave a class blank to use its tier rate —{" "}
          {inr(settings?.budget_per_student ?? DEFAULT_SETTINGS.primary.budget_per_student)} for
          primary,{" "}
          {inr(
            settings?.budget_per_student_upper ?? DEFAULT_SETTINGS.upper_primary.budget_per_student,
          )}{" "}
          for upper primary. This affects the budget only, not meal quantities.
        </p>
        {!lists?.classes.length ? (
          <p className="py-2 text-sm text-muted-foreground">
            No classes yet — add students before setting class rates.
          </p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              {lists.classes.map((c) => {
                const tier = tierForClass(c);
                return (
                  <div key={c}>
                    <label className="mb-1 block text-sm font-medium" htmlFor={`rate-${c}`}>
                      Class {c}{" "}
                      <span className="font-normal text-muted-foreground">
                        · {tier === "upper_primary" ? "upper primary" : "primary"}
                      </span>
                    </label>
                    <Input
                      id={`rate-${c}`}
                      type="number"
                      step="0.01"
                      min="0"
                      inputMode="decimal"
                      placeholder={String(toRates(settings)[tier].budget_per_student)}
                      value={rateInputs[c] ?? ""}
                      onChange={(e) => setRateInputs((m) => ({ ...m, [c]: e.target.value }))}
                    />
                  </div>
                );
              })}
            </div>
            <Separator className="my-4" />
            <Button
              type="button"
              onClick={() => saveRates.mutate()}
              disabled={saveRates.isPending}
              className="w-full sm:w-auto"
            >
              <Save className="mr-1.5 size-4" />
              {saveRates.isPending ? "Saving…" : "Save class rates"}
            </Button>
          </>
        )}
      </Card>

      <Card className="mt-4 p-5">
        <h2 className="text-sm font-semibold">Recent activity</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          The last actions recorded in this system.
        </p>
        <ul className="divide-y divide-border text-sm">
          {(audit ?? []).slice(0, 12).map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 py-2">
              <span className="truncate">
                <span className="font-medium capitalize">{a.action}</span>{" "}
                <span className="text-muted-foreground">{a.entity.replace("_", " ")}</span>
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {prettyDate(String(a.created_at).slice(0, 10))}
              </span>
            </li>
          ))}
          {!audit?.length && (
            <li className="py-2 text-muted-foreground">No activity recorded yet.</li>
          )}
        </ul>
      </Card>
    </>
  );
}
