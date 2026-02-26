"use client";

import { useEffect, useState, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Search,
  RefreshCw,
} from "lucide-react";

interface Transaction {
  id: number;
  userId: string;
  amount: number;
  pages: number;
  type: string;
  status: string;
  timestamp: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function JobsPage() {
  const { t, formatCurrency, formatDateTime } = useI18n();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [filterUserId, setFilterUserId] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [loading, setLoading] = useState(true);

  const fetchTransactions = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(pagination.limit),
        });
        if (filterUserId) params.set("userId", filterUserId);
        if (filterType !== "all") params.set("type", filterType);
        if (filterStatus !== "all") params.set("status", filterStatus);

        const res = await fetch(`/api/transactions?${params}`);
        const data = await res.json();
        setTransactions(data.transactions || []);
        setPagination(
          data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 },
        );
      } catch (error) {
        console.error("Failed to fetch transactions:", error);
      } finally {
        setLoading(false);
      }
    },
    [filterUserId, filterType, filterStatus, pagination.limit],
  );

  useEffect(() => {
    fetchTransactions(1);
  }, [fetchTransactions]);

  const handleCancelRefund = async (transactionId: number) => {
    try {
      const res = await fetch("/api/transactions/cancel-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(t("toast.cancelRefundSuccess"));
        fetchTransactions(pagination.page);
      } else {
        toast.error(data.error || t("toast.cancelRefundFailed"));
      }
    } catch {
      toast.error(t("toast.cancelRefundFailed"));
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "default";
      case "pending":
        return "secondary";
      case "refunded":
        return "outline";
      case "failed":
        return "destructive";
      default:
        return "default";
    }
  };

  const typeLabel = (type: string) => {
    switch (type) {
      case "deposit":
        return t("type.deposit");
      case "print_sw":
        return t("type.print_sw");
      case "print_color":
        return t("type.print_color");
      default:
        return type;
    }
  };

  const statusLabel = (status: string) => {
    const key = `status.${status}` as
      | "status.completed"
      | "status.pending"
      | "status.refunded"
      | "status.failed";
    return t(key);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("jobs.title")}</h1>
        <Button
          variant="outline"
          size="icon"
          onClick={() => fetchTransactions(pagination.page)}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("jobs.filterPlaceholder")}
            value={filterUserId}
            onChange={(e) => setFilterUserId(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t("common.type")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("jobs.allTypes")}</SelectItem>
            <SelectItem value="deposit">{t("type.deposit")}</SelectItem>
            <SelectItem value="print_sw">{t("type.print_sw")}</SelectItem>
            <SelectItem value="print_color">{t("type.print_color")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t("common.status")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("jobs.allStatus")}</SelectItem>
            <SelectItem value="pending">{t("status.pending")}</SelectItem>
            <SelectItem value="completed">{t("status.completed")}</SelectItem>
            <SelectItem value="refunded">{t("status.refunded")}</SelectItem>
            <SelectItem value="failed">{t("status.failed")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.id")}</TableHead>
              <TableHead>{t("common.user")}</TableHead>
              <TableHead>{t("common.type")}</TableHead>
              <TableHead>{t("common.amount")}</TableHead>
              <TableHead>{t("common.pages")}</TableHead>
              <TableHead>{t("common.status")}</TableHead>
              <TableHead>{t("common.date")}</TableHead>
              <TableHead className="w-[50px]">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center py-8 text-muted-foreground"
                >
                  {t("common.loading")}
                </TableCell>
              </TableRow>
            ) : transactions.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center py-8 text-muted-foreground"
                >
                  {t("jobs.noTransactions")}
                </TableCell>
              </TableRow>
            ) : (
              transactions.map((tx) => (
                <TableRow
                  key={tx.id}
                  className={
                    tx.status === "pending"
                      ? "bg-yellow-50 dark:bg-yellow-950/20"
                      : ""
                  }
                >
                  <TableCell className="font-mono text-sm">{tx.id}</TableCell>
                  <TableCell className="font-medium">{tx.userId}</TableCell>
                  <TableCell>{typeLabel(tx.type)}</TableCell>
                  <TableCell>{formatCurrency(tx.amount)}</TableCell>
                  <TableCell>{tx.pages || "-"}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        statusColor(tx.status) as
                          | "default"
                          | "secondary"
                          | "outline"
                          | "destructive"
                      }
                    >
                      {statusLabel(tx.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDateTime(tx.timestamp)}
                  </TableCell>
                  <TableCell>
                    {tx.status === "pending" && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleCancelRefund(tx.id)}
                            className="text-destructive"
                          >
                            {t("jobs.cancelRefund")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t("jobs.pageOf", {
              page: pagination.page,
              totalPages: pagination.totalPages,
              total: pagination.total,
            })}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={pagination.page <= 1}
              onClick={() => fetchTransactions(pagination.page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => fetchTransactions(pagination.page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
