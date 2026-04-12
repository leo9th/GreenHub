import type { ChatMessageRow } from "../../utils/chatMessages";
import { outgoingReceiptPhase } from "../../utils/chatMessages";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";

function phaseLabel(phase: ReturnType<typeof outgoingReceiptPhase>): string {
  switch (phase) {
    case "sending":
      return "Sending";
    case "sent":
      return "Sent";
    case "delivered":
      return "Delivered";
    case "read":
      return "Read";
    default:
      return "—";
  }
}

export type MessageInfoDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: ChatMessageRow | null;
  isMine: boolean;
  peerFirstName: string;
};

export function MessageInfoDialog({ open, onOpenChange, message, isMine, peerFirstName }: MessageInfoDialogProps) {
  if (!message) return null;
  const created = new Date(message.created_at);
  const createdOk = !Number.isNaN(created.getTime());
  const phase = outgoingReceiptPhase(message);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Message info</DialogTitle>
        </DialogHeader>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Direction</dt>
            <dd className="text-right font-medium">
              {isMine ? "Outgoing" : `Incoming (${peerFirstName})`}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Sent</dt>
            <dd className="text-right tabular-nums">
              {createdOk ? created.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—"}
            </dd>
          </div>
          {message.edited ? (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Edited</dt>
              <dd className="text-right">Yes</dd>
            </div>
          ) : null}
          {message.edited_at ? (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Edited at</dt>
              <dd className="text-right tabular-nums">
                {new Date(message.edited_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
              </dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Delivered</dt>
            <dd className="text-right tabular-nums">
              {message.delivered_at
                ? new Date(message.delivered_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
                : "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Read</dt>
            <dd className="text-right tabular-nums">
              {message.read_at
                ? new Date(message.read_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
                : "—"}
            </dd>
          </div>
          {isMine ? (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Status</dt>
              <dd className="text-right font-medium">{phaseLabel(phase)}</dd>
            </div>
          ) : null}
          <div className="border-t pt-2">
            <dt className="text-muted-foreground mb-1">Message id</dt>
            <dd className="break-all font-mono text-[11px] text-muted-foreground">{message.id}</dd>
          </div>
        </dl>
      </DialogContent>
    </Dialog>
  );
}
