"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  Menu, 
  FolderKanban, 
  LayoutDashboard, 
  LogOut, 
  Settings, 
  Users, 
  ChevronRight,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { signOut } from "@/lib/auth-client";
import { toast } from "sonner";

interface User {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

interface MobileNavProps {
  user: User;
}

const navigation = [
  {
    name: "Teams",
    href: "/teams",
    icon: Users,
    children: [
      {
        name: "Projects",
        href: "/projects",
        icon: FolderKanban,
      },
    ],
  },
];

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function MobileNav({ user }: MobileNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>(() => {
    if (pathname.startsWith("/projects")) {
      return ["Teams"];
    }
    return [];
  });

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success("Signed out successfully");
      router.push("/login");
      router.refresh();
    } catch {
      toast.error("Failed to sign out");
    }
  };

  const toggleExpanded = (itemName: string) => {
    setExpandedItems((prev) =>
      prev.includes(itemName)
        ? prev.filter((name) => name !== itemName)
        : [...prev, itemName]
    );
  };

  const handleNavClick = () => {
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle navigation menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0 flex flex-col">
        <SheetHeader className="flex h-14 items-center gap-2 border-b border-border px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <LayoutDashboard className="h-4 w-4" />
            </div>
            <SheetTitle className="text-lg font-semibold tracking-tight">
              Minute
            </SheetTitle>
          </div>
        </SheetHeader>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const isExpanded = expandedItems.includes(item.name);
            const hasChildren = item.children && item.children.length > 0;

            return (
              <div key={item.name}>
                <div className="flex items-center">
                  {hasChildren ? (
                    <div className="flex flex-1 items-center gap-1">
                      <Link
                        href={item.href}
                        onClick={handleNavClick}
                        className={cn(
                          "flex flex-1 items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                          isActive
                            ? "bg-accent text-accent-foreground"
                            : "text-foreground hover:bg-accent/50"
                        )}
                      >
                        <item.icon className="h-5 w-5" />
                        <span className="flex-1 text-left">{item.name}</span>
                      </Link>
                      <button
                        onClick={() => toggleExpanded(item.name)}
                        className={cn(
                          "p-2 rounded-md transition-colors",
                          "text-foreground hover:bg-accent/50"
                        )}
                      >
                        <ChevronRight
                          className={cn(
                            "h-4 w-4 transition-transform",
                            isExpanded && "rotate-90"
                          )}
                        />
                      </button>
                    </div>
                  ) : (
                    <Link
                      href={item.href}
                      onClick={handleNavClick}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors w-full",
                        isActive
                          ? "bg-accent text-accent-foreground"
                          : "text-foreground hover:bg-accent/50"
                      )}
                    >
                      <item.icon className="h-5 w-5" />
                      {item.name}
                    </Link>
                  )}
                </div>
                {hasChildren && isExpanded && (
                  <div className="ml-4 mt-1 space-y-1 border-l border-border pl-2">
                    {item.children?.map((child) => {
                      const isChildActive = pathname.startsWith(child.href);
                      return (
                        <Link
                          key={child.name}
                          href={child.href}
                          onClick={handleNavClick}
                          className={cn(
                            "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                            isChildActive
                              ? "bg-accent text-accent-foreground"
                              : "text-foreground hover:bg-accent/50"
                          )}
                        >
                          <child.icon className="h-5 w-5" />
                          {child.name}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* User Section */}
        <div className="border-t border-border p-3">
          <div className="flex items-center gap-3 px-2 py-2">
            <Avatar className="h-9 w-9">
              <AvatarImage src={user.image || undefined} alt={user.name} />
              <AvatarFallback className="text-xs">
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col items-start text-left flex-1 min-w-0">
              <span className="text-sm font-medium truncate w-full">
                {user.name}
              </span>
              <span className="text-xs text-muted-foreground truncate w-full">
                {user.email}
              </span>
            </div>
          </div>
          <Separator className="my-2" />
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 px-3"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

