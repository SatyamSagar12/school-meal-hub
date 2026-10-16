"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { confirmUpiAction, extendSchoolAction, rejectUpiAction, setSuspendedAction } from "@/server/actions/admin";
import type { Result } from "@/lib/result";

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<Result<null>>, success: string) =>
    start(async () => {
      const result = await fn();
      if (result.ok) {
        toast.success(success);
        router.refresh();
      } else toast.error(result.error.message);
    });
  return { pending, run };
}

export function UpiActions({ paymentId }: { paymentId: string }) {
  const { pending, run } = useRun();
  return (
    <span className="flex gap-2">
      <Button size="sm" disabled={pending} onClick={() => run(() => confirmUpiAction(paymentId), "Confirmed — the school has its year")}>
        Received
      </Button>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => confirm("Mark as not received?") && run(() => rejectUpiAction(paymentId), "Rejected")}>
        Not received
      </Button>
    </span>
  );
}

export function PlatformActions({ schoolId, suspended }: { schoolId: string; suspended: boolean }) {
  const { pending, run } = useRun();
  return (
    <span className="flex justify-end gap-1">
      <Button
        size="xs"
        variant="outline"
        disabled={pending}
        onClick={() => {
          const days = Number(prompt("Extend by how many days?", "30"));
          if (days) run(() => extendSchoolAction(schoolId, days), `Extended by ${days} days`);
        }}
      >
        Extend
      </Button>
      <Button
        size="xs"
        variant={suspended ? "outline" : "destructive"}
        disabled={pending}
        onClick={() => confirm(suspended ? "Lift the suspension?" : "Suspend this school?") && run(() => setSuspendedAction(schoolId, !suspended), suspended ? "Unsuspended" : "Suspended")}
      >
        {suspended ? "Unsuspend" : "Suspend"}
      </Button>
    </span>
  );
}
