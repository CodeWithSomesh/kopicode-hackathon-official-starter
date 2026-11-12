import { Badge } from "@/components/ui/badge";
import type { ItemStatus } from "@/lib/supabase/database.types";

export const STATUS_LABEL: Record<ItemStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};

export function StatusBadge({ status }: { status: ItemStatus }) {
  const variant = status === "done" ? "success" : status === "in_progress" ? "warning" : "secondary";
  return <Badge variant={variant}>{STATUS_LABEL[status]}</Badge>;
}
