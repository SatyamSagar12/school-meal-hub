"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { submitUpiAction } from "@/server/actions/admin";

export function UpiForm() {
  const router = useRouter();
  const [utr, setUtr] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      className="mt-4 grid gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const result = await submitUpiAction(utr);
          if (result.ok) {
            toast.success("Thank you! We'll confirm the payment shortly.");
            router.refresh();
          } else toast.error(result.error.message);
        });
      }}
    >
      <label className="grid gap-1 text-sm font-medium">
        After paying, enter the 12-digit UPI reference (UTR)
        <Input inputMode="numeric" maxLength={14} placeholder="e.g. 412345678901" value={utr} onChange={(e) => setUtr(e.target.value)} className="w-60" />
      </label>
      <Button type="submit" variant="outline" disabled={pending} className="w-fit">
        {pending ? "Sending…" : "I have paid"}
      </Button>
    </form>
  );
}
