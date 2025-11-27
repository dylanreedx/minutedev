import Link from "next/link";
import { LayoutGrid, Plus } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Ticket list/table page - will be fully implemented in Phase 4 (MIN-19)
interface ListPageProps {
  params: Promise<{ slug: string }>;
}

export default async function ListPage({ params }: ListPageProps) {
  const { slug } = await params;
  
  return (
    <>
      <Header title={slug}>
        <Link href={`/projects/${slug}/board`}>
          <Button variant="outline" size="sm">
            <LayoutGrid className="mr-2 h-4 w-4" />
            Board View
          </Button>
        </Link>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add Ticket
        </Button>
      </Header>

      {/* Table */}
      <div className="p-6">
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Due Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  No tickets yet
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}

