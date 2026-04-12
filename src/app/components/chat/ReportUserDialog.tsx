import React, { useCallback, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../../../lib/supabase";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Label } from "../ui/label";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { Textarea } from "../ui/textarea";

const REASONS = [
  { value: "Scam", label: "Scam" },
  { value: "Harassment", label: "Harassment" },
  { value: "Fake product", label: "Fake product" },
  { value: "Other", label: "Other" },
] as const;

export type ReportUserDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reporterId: string | undefined;
  reportedUserId: string | null;
};

export function ReportUserDialog({ open, onOpenChange, reporterId, reportedUserId }: ReportUserDialogProps) {
  const [reason, setReason] = useState<string>(REASONS[0].value);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = useCallback(() => {
    setReason(REASONS[0].value);
    setDetails("");
  }, []);

  const submit = useCallback(async () => {
    if (!reporterId || !reportedUserId) {
      toast.error("Cannot submit report.");
      return;
    }
    if (reporterId === reportedUserId) {
      toast.error("Invalid report.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.from("user_reports").insert({
        reporter_id: reporterId,
        reported_user_id: reportedUserId,
        reason,
        details: details.trim() || null,
        status: "pending",
      });
      if (error) throw error;
      toast.success("Report submitted. Thank you for helping keep GreenHub safe.");
      reset();
      onOpenChange(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not submit report");
    } finally {
      setBusy(false);
    }
  }, [reporterId, reportedUserId, reason, details, reset, onOpenChange]);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report user</DialogTitle>
          <DialogDescription>
            Tell us what happened. Reports are reviewed by the team.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <Label className="text-sm font-medium">Reason</Label>
          <RadioGroup value={reason} onValueChange={setReason} className="grid gap-2">
            {REASONS.map((r) => (
              <label
                key={r.value}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-zinc-700"
              >
                <RadioGroupItem value={r.value} id={`reason-${r.value}`} />
                <span>{r.label}</span>
              </label>
            ))}
          </RadioGroup>
          <div className="space-y-1.5">
            <Label htmlFor="report-details" className="text-sm font-medium">
              Details (optional)
            </Label>
            <Textarea
              id="report-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              placeholder="Add any extra context…"
              className="resize-none text-sm"
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={busy || !reportedUserId}>
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting…
              </>
            ) : (
              "Submit report"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
