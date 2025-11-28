"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateProjectDialog } from "@/components/projects";

export function CreateProjectButton({ variant = "default", size = "sm" }: { variant?: "default" | "outline" | "ghost"; size?: "sm" | "default" | "lg" }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size={size} variant={variant} onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        Create Project
      </Button>
      <CreateProjectDialog open={open} onOpenChange={setOpen} />
    </>
  );
}




