"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, X, Filter, CircleDashed, Signal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function TicketFilters({ className }: { className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Local state for search input to allow debouncing
  const [searchValue, setSearchValue] = React.useState(
    searchParams.get("search") || ""
  );

  // Debounce search update
  React.useEffect(() => {
    const timer = setTimeout(() => {
      updateFilter("search", searchValue);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchValue]);

  // Update URL params
  const updateFilter = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.replace(`${pathname}?${params.toString()}`);
  };

  // Helper to toggle multi-select values
  const toggleValue = (key: string, value: string) => {
    const current = searchParams.get(key)?.split(",").filter(Boolean) || [];
    const newValues = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    
    updateFilter(key, newValues.length > 0 ? newValues.join(",") : null);
  };

  const clearFilters = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("search");
    params.delete("status");
    params.delete("priority");
    setSearchValue("");
    router.replace(`${pathname}?${params.toString()}`);
  };

  const hasFilters = 
    !!searchParams.get("search") || 
    !!searchParams.get("status") || 
    !!searchParams.get("priority");

  const statusFilters = searchParams.get("status")?.split(",") || [];
  const priorityFilters = searchParams.get("priority")?.split(",") || [];

  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-center", className)}>
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Filter tickets..."
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          className="pl-9 w-full sm:w-[300px]"
        />
      </div>
      
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 border-dashed">
              <CircleDashed className="mr-2 h-4 w-4" />
              Status
              {statusFilters.length > 0 && (
                <>
                  <div className="mx-2 h-4 w-px bg-accent" />
                  <Badge variant="secondary" className="rounded-sm px-1 font-normal lg:hidden">
                    {statusFilters.length}
                  </Badge>
                  <div className="hidden space-x-1 lg:flex">
                    {statusFilters.length > 2 ? (
                      <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                        {statusFilters.length} selected
                      </Badge>
                    ) : (
                      statusFilters.map((status) => (
                        <Badge
                          variant="secondary"
                          key={status}
                          className="rounded-sm px-1 font-normal capitalize"
                        >
                          {status === "in_progress" ? "In Progress" : status}
                        </Badge>
                      ))
                    )}
                  </div>
                </>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[200px]">
            <DropdownMenuLabel>Filter by status</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={statusFilters.includes("backlog")}
              onCheckedChange={() => toggleValue("status", "backlog")}
            >
              Backlog
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={statusFilters.includes("todo")}
              onCheckedChange={() => toggleValue("status", "todo")}
            >
              Todo
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={statusFilters.includes("in_progress")}
              onCheckedChange={() => toggleValue("status", "in_progress")}
            >
              In Progress
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={statusFilters.includes("done")}
              onCheckedChange={() => toggleValue("status", "done")}
            >
              Done
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 border-dashed">
              <Signal className="mr-2 h-4 w-4" />
              Priority
              {priorityFilters.length > 0 && (
                <>
                  <div className="mx-2 h-4 w-px bg-accent" />
                  <Badge variant="secondary" className="rounded-sm px-1 font-normal lg:hidden">
                    {priorityFilters.length}
                  </Badge>
                  <div className="hidden space-x-1 lg:flex">
                    {priorityFilters.length > 2 ? (
                      <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                        {priorityFilters.length} selected
                      </Badge>
                    ) : (
                      priorityFilters.map((priority) => (
                        <Badge
                          variant="secondary"
                          key={priority}
                          className="rounded-sm px-1 font-normal capitalize"
                        >
                          {priority}
                        </Badge>
                      ))
                    )}
                  </div>
                </>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[200px]">
            <DropdownMenuLabel>Filter by priority</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={priorityFilters.includes("low")}
              onCheckedChange={() => toggleValue("priority", "low")}
            >
              Low
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={priorityFilters.includes("medium")}
              onCheckedChange={() => toggleValue("priority", "medium")}
            >
              Medium
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={priorityFilters.includes("high")}
              onCheckedChange={() => toggleValue("priority", "high")}
            >
              High
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={priorityFilters.includes("urgent")}
              onCheckedChange={() => toggleValue("priority", "urgent")}
            >
              Urgent
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {hasFilters && (
          <Button
            variant="ghost"
            onClick={clearFilters}
            className="h-9 px-2 lg:px-3"
          >
            Reset
            <X className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
