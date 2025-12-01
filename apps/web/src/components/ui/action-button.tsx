"use client";

import { useState, cloneElement, isValidElement } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Plus, Pencil, Trash2, UserPlus, Loader2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const actionButtonVariants = cva("", {
  variants: {
    action: {
      create: "",
      edit: "",
      delete: "",
      invite: "",
    },
    entity: {
      project: "",
      ticket: "",
      team: "",
    },
  },
  defaultVariants: {
    action: "create",
    entity: "project",
  },
});

// Default icon mapping
const defaultIcons = {
  create: Plus,
  edit: Pencil,
  delete: Trash2,
  invite: UserPlus,
} as const;

// Default text mapping
const defaultText: Record<
  "create" | "edit" | "delete" | "invite",
  Record<"project" | "ticket" | "team", string>
> = {
  create: {
    project: "Create Project",
    ticket: "Add Ticket",
    team: "Create Team",
  },
  edit: {
    project: "Edit Project",
    ticket: "Edit Ticket",
    team: "Edit Team",
  },
  delete: {
    project: "Delete Project",
    ticket: "Delete Ticket",
    team: "Delete Team",
  },
  invite: {
    project: "Invite",
    ticket: "Invite",
    team: "Invite",
  },
};

export interface ActionButtonProps
  extends Omit<
      React.ComponentProps<typeof Button>,
      "variant" | "size" | "children"
    >,
    VariantProps<typeof actionButtonVariants> {
  action: "create" | "edit" | "delete" | "invite";
  entity: "project" | "ticket" | "team";
  variant?: VariantProps<typeof buttonVariants>["variant"];
  size?: VariantProps<typeof buttonVariants>["size"];
  dialog?: React.ReactNode | ((props: { open: boolean; onOpenChange: (open: boolean) => void }) => React.ReactNode);
  icon?: React.ReactNode;
  children?: React.ReactNode;
  isLoading?: boolean;
}

export function ActionButton({
  action,
  entity,
  variant = "default",
  size = "sm",
  dialog,
  icon,
  children,
  isLoading = false,
  className,
  onClick,
  disabled,
  ...props
}: ActionButtonProps) {
  const [open, setOpen] = useState(false);

  // Get default icon if not provided
  const DefaultIcon = defaultIcons[action];
  const iconElement = icon ?? <DefaultIcon className="mr-2 h-4 w-4" />;

  // Get default text if not provided
  const text = children ?? defaultText[action][entity];

  // Handle button click
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (onClick) {
      onClick(e);
    }
    if (dialog) {
      setOpen(true);
    }
  };

  // Handle dialog rendering - either a function or a React element
  const dialogElement = dialog
    ? typeof dialog === "function"
      ? dialog({ open, onOpenChange: setOpen })
      : isValidElement(dialog)
      ? cloneElement(
          dialog as React.ReactElement<{ open?: boolean; onOpenChange?: (open: boolean) => void }>,
          {
            open,
            onOpenChange: setOpen,
          }
        )
      : dialog
    : null;

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={handleClick}
        disabled={disabled || isLoading}
        className={cn(
          actionButtonVariants({ action, entity }),
          className
        )}
        {...props}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {text}
          </>
        ) : (
          <>
            {iconElement}
            {text}
          </>
        )}
      </Button>
      {dialogElement}
    </>
  );
}

