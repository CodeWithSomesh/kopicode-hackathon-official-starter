"use client";

import { useTransition } from "react";
import { MoreHorizontalIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Item } from "@/lib/supabase/database.types";
import { formatDate } from "@/lib/utils";
import { deleteItem } from "./actions";
import { ItemDialog } from "./item-dialog";
import { StatusBadge } from "./status-badge";

const money = new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" });

export function ItemsTable({ items }: { items: Item[] }) {
  const [pending, startTransition] = useTransition();

  function onDelete(id: string) {
    if (!confirm("Delete this item? This can't be undone.")) return;
    startTransition(async () => {
      const res = await deleteItem(id);
      if (res?.ok) toast.success(res.message);
      else toast.error(res?.message ?? "Something went wrong");
    });
  }

  return (
    <Table aria-busy={pending}>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="pl-5">Title</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead className="hidden md:table-cell">Created</TableHead>
          <TableHead className="w-12 pr-5"><span className="sr-only">Actions</span></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell className="max-w-[18rem] pl-5">
              <p className="truncate font-medium">{item.title}</p>
              {item.description ? (
                <p className="truncate text-xs text-muted-foreground">{item.description}</p>
              ) : null}
            </TableCell>
            <TableCell><StatusBadge status={item.status} /></TableCell>
            <TableCell className="text-right tabular-nums">{money.format(Number(item.amount))}</TableCell>
            <TableCell className="hidden text-muted-foreground md:table-cell">{formatDate(item.created_at)}</TableCell>
            <TableCell className="pr-5">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${item.title}`}>
                    <MoreHorizontalIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <ItemDialog
                    item={item}
                    trigger={
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <PencilIcon /> Edit
                      </DropdownMenuItem>
                    }
                  />
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => onDelete(item.id)}>
                    <Trash2Icon className="text-destructive" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
