"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Plus, Trash2, Save } from "lucide-react";

interface Supervisor {
  id: number;
  username: string;
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const [priceBw, setPriceBw] = useState("");
  const [priceColor, setPriceColor] = useState("");
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [savingPrices, setSavingPrices] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();
      setPriceBw(data.price_sw || "5");
      setPriceColor(data.price_color || "20");
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    }
  }, []);

  const fetchSupervisors = useCallback(async () => {
    try {
      const res = await fetch("/api/supervisors");
      const data = await res.json();
      setSupervisors(data);
    } catch (error) {
      console.error("Failed to fetch supervisors:", error);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchSupervisors();
  }, [fetchSettings, fetchSupervisors]);

  const handleSavePrices = async () => {
    const bw = parseInt(priceBw, 10);
    const color = parseInt(priceColor, 10);
    if (isNaN(bw) || isNaN(color) || bw < 0 || color < 0) {
      toast.error("Prices must be non-negative integers (in cents).");
      return;
    }
    setSavingPrices(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          price_sw: String(bw),
          price_color: String(color),
        }),
      });
      if (res.ok) {
        toast.success("Prices updated successfully");
      } else {
        toast.error("Failed to update prices");
      }
    } catch {
      toast.error("Failed to update prices");
    } finally {
      setSavingPrices(false);
    }
  };

  const handleAddSupervisor = async () => {
    if (!newUsername.trim() || !newPassword.trim()) {
      toast.error("Username and password are required");
      return;
    }
    try {
      const res = await fetch("/api/supervisors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: newUsername.trim(),
          password: newPassword,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Supervisor ${newUsername} created`);
        setNewUsername("");
        setNewPassword("");
        setAddDialogOpen(false);
        fetchSupervisors();
      } else {
        toast.error(data.error || "Failed to create supervisor");
      }
    } catch {
      toast.error("Failed to create supervisor");
    }
  };

  const handleDeleteSupervisor = async (supervisor: Supervisor) => {
    if (supervisor.username === session?.user?.name) {
      toast.error("You cannot delete your own account");
      return;
    }
    try {
      const res = await fetch("/api/supervisors", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: supervisor.id }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Supervisor ${supervisor.username} deleted`);
        fetchSupervisors();
      } else {
        toast.error(data.error || "Failed to delete supervisor");
      }
    } catch {
      toast.error("Failed to delete supervisor");
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Settings</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Print Prices */}
        <Card>
          <CardHeader>
            <CardTitle>Print Prices</CardTitle>
            <CardDescription>Set the price per page in cents.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="priceBw">B&W Price (cents/page)</Label>
                <Input
                  id="priceBw"
                  type="number"
                  min="0"
                  value={priceBw}
                  onChange={(e) => setPriceBw(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Current: {priceBw} ct ={" "}
                  {(parseInt(priceBw || "0", 10) / 100).toFixed(2)} €
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="priceColor">Color Price (cents/page)</Label>
                <Input
                  id="priceColor"
                  type="number"
                  min="0"
                  value={priceColor}
                  onChange={(e) => setPriceColor(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Current: {priceColor} ct ={" "}
                  {(parseInt(priceColor || "0", 10) / 100).toFixed(2)} €
                </p>
              </div>
            </div>
            <Button onClick={handleSavePrices} disabled={savingPrices}>
              <Save className="h-4 w-4 mr-2" /> Save Prices
            </Button>
          </CardContent>
        </Card>

        <Separator />

        {/* Supervisors */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Supervisors</CardTitle>
              <CardDescription>Manage supervisor accounts.</CardDescription>
            </div>
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" /> Add Supervisor
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Supervisor</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="supUsername">Username</Label>
                    <Input
                      id="supUsername"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      placeholder="Username"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="supPassword">Password</Label>
                    <Input
                      id="supPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Password"
                    />
                  </div>
                  <Button onClick={handleAddSupervisor} className="w-full">
                    Create Supervisor
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {supervisors.map((sup) => (
                  <TableRow key={sup.id}>
                    <TableCell className="font-medium">
                      {sup.username}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteSupervisor(sup)}
                        disabled={sup.username === session?.user?.name}
                        title={
                          sup.username === session?.user?.name
                            ? "Cannot delete yourself"
                            : "Delete supervisor"
                        }
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
