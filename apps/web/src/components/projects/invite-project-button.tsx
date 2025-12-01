"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InviteMemberDialog } from "./invite-member-dialog";

interface InviteProjectButtonProps {
  projectId: string;
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "default" | "lg";
}

export function InviteProjectButton({
  projectId,
  variant = "outline",
  size = "sm",
}: InviteProjectButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        <UserPlus className="mr-2 h-4 w-4" />
        Invite
      </Button>
      <InviteMemberDialog
        open={open}
        onOpenChange={setOpen}
        projectId={projectId}
      />
    </>
  );
}



