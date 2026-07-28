import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Save, ShieldCheck } from "lucide-react";
import { useEffect } from "react";
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
import { auditQuery, logAudit, meQuery, settingsQuery, updateSettings } from "@/lib/api";
import { DEFAULT_SETTINGS, prettyDate } from "@/lib/mdm";
import { settingsSchema, type SettingsFormValues } from "@/lib/schemas";

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

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      school_name: "",
      academic_year: "",
      ...DEFAULT_SETTINGS,
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
      });
      await logAudit("update", "settings", undefined, { school_name: v.school_name });
    },
    onSuccess: () => {
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["settings"] });
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
            <h2 className="text-sm font-semibold">Per-student meal quantities</h2>
            <p className="mb-3 text-xs text-muted-foreground">
              Used to calculate the daily rice, dal and vegetable requirement from the attendance
              count.
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              {numberField(
                "rice_per_student_g",
                "Rice (grams)",
                "Government supply — quantity only, no cost",
              )}
              {numberField("dal_per_student_g", "Dal (grams)", "Costed at the daily dal rate")}
              {numberField(
                "veg_per_student_g",
                "Vegetables (grams)",
                "Costed at the daily vegetable rate",
              )}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold">Cost and budget rates</h2>
            <p className="mb-3 text-xs text-muted-foreground">
              Applied per present student when calculating daily expenditure and credits saved.
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              {numberField(
                "budget_per_student",
                "Budget (₹)",
                "Sanctioned cooking cost per meal",
                "0.01",
              )}
              {numberField(
                "masala_per_student",
                "Masala (₹)",
                "Fixed condiment cost per meal",
                "0.01",
              )}
              {numberField(
                "fuel_per_student",
                "Fuel (₹)",
                "Fixed cooking fuel cost per meal",
                "0.01",
              )}
            </div>
            <Separator className="my-4" />
            <Button type="submit" disabled={save.isPending} className="w-full sm:w-auto">
              <Save className="mr-1.5 size-4" /> {save.isPending ? "Saving…" : "Save settings"}
            </Button>
          </Card>
        </form>
      </Form>

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
