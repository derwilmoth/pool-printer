"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Search, Plus, DollarSign, UserCheck, UserX } from "lucide-react";
import { useAppStore } from "@/lib/useAppStore";

interface User {
  userId: string;
  balance: number;
  is_free_account: number;
}

interface Transaction {
  id: number;
  userId: string;
  amount: number;
  pages: number;
  type: string;
  status: string;
  timestamp: string;
}

function formatCents(cents: number): string {
  return (cents / 100).toFixed(2) + " €";
}

export default function UsersPage() {
  const { selectedUserId, setSelectedUserId, clearSelectedUserId } =
    useAppStore();
  const [searchQuery, setSearchQuery] = useState(selectedUserId || "");
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userTransactions, setUserTransactions] = useState<Transaction[]>([]);
  const [depositAmount, setDepositAmount] = useState("");
  const [newUserId, setNewUserId] = useState("");
  const [newUserIsFree, setNewUserIsFree] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const searchUsers = useCallback(async (query?: string) => {
    try {
      const searchVal = query ?? "";
      const url = searchVal
        ? `/api/users?search=${encodeURIComponent(searchVal)}`
        : "/api/users";
      const res = await fetch(url);
      const data = await res.json();
      setUsers(data);
    } catch (error) {
      console.error("Failed to search users:", error);
    }
  }, []);

  const fetchUserTransactions = useCallback(async (userId: string) => {
    try {
      const res = await fetch(
        `/api/transactions?userId=${encodeURIComponent(userId)}&limit=20`,
      );
      const data = await res.json();
      setUserTransactions(data.transactions || []);
    } catch (error) {
      console.error("Failed to fetch transactions:", error);
    }
  }, []);

  useEffect(() => {
    searchUsers(searchQuery);
  }, [searchUsers, searchQuery]);

  const selectUser = useCallback(
    (user: User) => {
      setSelectedUser(user);
      setSelectedUserId(user.userId);
      fetchUserTransactions(user.userId);
    },
    [setSelectedUserId, fetchUserTransactions],
  );

  useEffect(() => {
    if (selectedUserId && users.length > 0) {
      const found = users.find((u) => u.userId === selectedUserId);
      if (found && !selectedUser) {
        selectUser(found);
      }
    }
  }, [selectedUserId, users, selectedUser, selectUser]);

  const handleDeposit = async () => {
    if (!selectedUser || !depositAmount) return;
    const amountCents = Math.round(parseFloat(depositAmount) * 100);
    if (isNaN(amountCents) || amountCents <= 0) {
      toast.error("Please enter a valid positive amount.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/users/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser.userId,
          amount: amountCents,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(
          `Deposited ${formatCents(amountCents)} to ${selectedUser.userId}. New balance: ${formatCents(data.newBalance)}`,
        );
        setDepositAmount("");
        setSelectedUser({ ...selectedUser, balance: data.newBalance });
        fetchUserTransactions(selectedUser.userId);
        searchUsers(searchQuery);
      } else {
        toast.error(data.error || "Deposit failed");
      }
    } catch {
      toast.error("Deposit failed");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    if (!newUserId.trim()) {
      toast.error("User ID is required");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: newUserId.trim(),
          is_free_account: newUserIsFree,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`User ${newUserId} created`);
        setNewUserId("");
        setNewUserIsFree(false);
        setCreateDialogOpen(false);
        searchUsers(searchQuery);
      } else {
        toast.error(data.error || "Failed to create user");
      }
    } catch {
      toast.error("Failed to create user");
    } finally {
      setLoading(false);
    }
  };

  const toggleFreeAccount = async (user: User) => {
    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.userId,
          is_free_account: !user.is_free_account,
        }),
      });
      if (res.ok) {
        toast.success(
          `${user.userId} is now ${user.is_free_account ? "a normal account" : "a free account"}`,
        );
        searchUsers(searchQuery);
        if (selectedUser?.userId === user.userId) {
          setSelectedUser({
            ...selectedUser,
            is_free_account: user.is_free_account ? 0 : 1,
          });
        }
      }
    } catch {
      toast.error("Failed to update user");
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
        return "Deposit";
      case "print_sw":
        return "Print (B&W)";
      case "print_color":
        return "Print (Color)";
      default:
        return type;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Manage Users</h1>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" /> New User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="newUserId">User ID</Label>
                <Input
                  id="newUserId"
                  value={newUserId}
                  onChange={(e) => setNewUserId(e.target.value)}
                  placeholder="e.g. student123"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isFree"
                  checked={newUserIsFree}
                  onChange={(e) => setNewUserIsFree(e.target.checked)}
                  className="h-4 w-4"
                />
                <Label htmlFor="isFree">Free Supervisor Print Account</Label>
              </div>
              <Button
                onClick={handleCreateUser}
                disabled={loading}
                className="w-full"
              >
                Create User
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by User ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* User Cards Grid */}
      {users.length === 0 ? (
        <p className="text-muted-foreground text-sm">No users found.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {users.map((user) => (
            <Card
              key={user.userId}
              className="cursor-pointer transition-colors hover:bg-accent"
              onClick={() => selectUser(user)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium truncate">{user.userId}</p>
                  {user.is_free_account ? (
                    <Badge variant="secondary">Free</Badge>
                  ) : null}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Balance: {formatCents(user.balance)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* User Detail Dialog */}
      <Dialog
        open={!!selectedUser}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedUser(null);
            setDepositAmount("");
            clearSelectedUserId();
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedUser && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between pr-6">
                  <span>{selectedUser.userId}</span>
                  {selectedUser.is_free_account ? (
                    <Badge variant="secondary">Free Account</Badge>
                  ) : (
                    <Badge>Balance: {formatCents(selectedUser.balance)}</Badge>
                  )}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-6 pt-2">
                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleFreeAccount(selectedUser)}
                  >
                    {selectedUser.is_free_account ? (
                      <>
                        <UserX className="h-4 w-4 mr-2" /> Make Normal
                      </>
                    ) : (
                      <>
                        <UserCheck className="h-4 w-4 mr-2" /> Make Free
                      </>
                    )}
                  </Button>
                </div>

                {/* Deposit */}
                <div className="space-y-2">
                  <Label>Add Deposit</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="Amount in € (e.g. 5.00)"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                    />
                    <Button
                      onClick={handleDeposit}
                      disabled={loading || !depositAmount}
                    >
                      <DollarSign className="h-4 w-4 mr-2" /> Deposit
                    </Button>
                  </div>
                </div>

                {/* Recent Transactions */}
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm">Recent Transactions</h3>
                  {userTransactions.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      No transactions yet.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Pages</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {userTransactions.map((tx) => (
                          <TableRow key={tx.id}>
                            <TableCell>{typeLabel(tx.type)}</TableCell>
                            <TableCell>{formatCents(tx.amount)}</TableCell>
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
                                {tx.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {new Date(tx.timestamp).toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
