"use client";

import { useActionState, useEffect } from "react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfile, type ProfileState } from "./actions";

export function ProfileForm({ name, email, disabled }: { name: string; email: string; disabled: boolean }) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(updateProfile, null);

  useEffect(() => {
    if (state) (state.ok ? toast.success : toast.error)(state.message);
  }, [state]);

  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="fullName">Name</Label>
        <Input id="fullName" name="fullName" defaultValue={name} maxLength={100} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" value={email} disabled readOnly />
      </div>
      <Button type="submit" className="w-fit" disabled={pending || disabled}>
        {pending ? <Loader2Icon className="animate-spin" /> : null}
        Save
      </Button>
    </form>
  );
}
