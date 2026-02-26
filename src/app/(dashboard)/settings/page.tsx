"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useI18n } from "@/lib/i18n";
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
  const { t, formatCurrency } = useI18n();
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
      toast.error(t("toast.pricesInvalid"));
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
        toast.success(t("toast.pricesUpdated"));
      } else {
        toast.error(t("toast.pricesFailed"));
      }
    } catch {
      toast.error(t("toast.pricesFailed"));
    } finally {
      setSavingPrices(false);
    }
  };

  const handleAddSupervisor = async () => {
    if (!newUsername.trim() || !newPassword.trim()) {
      toast.error(t("toast.usernamePasswordRequired"));
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
        toast.success(t("toast.supervisorCreated", { name: newUsername }));
        setNewUsername("");
        setNewPassword("");
        setAddDialogOpen(false);
        fetchSupervisors();
      } else {
        toast.error(data.error || t("toast.supervisorCreateFailed"));
      }
    } catch {
      toast.error(t("toast.supervisorCreateFailed"));
    }
  };

  const handleDeleteSupervisor = async (supervisor: Supervisor) => {
    if (supervisor.username === session?.user?.name) {
      toast.error(t("toast.cannotDeleteSelf"));
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
        toast.success(
          t("toast.supervisorDeleted", { name: supervisor.username }),
        );
        fetchSupervisors();
      } else {
        toast.error(data.error || t("toast.supervisorDeleteFailed"));
      }
    } catch {
      toast.error(t("toast.supervisorDeleteFailed"));
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t("settings.title")}</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Print Prices */}
        <Card>
          <CardHeader>
            <CardTitle>{t("settings.printPrices")}</CardTitle>
            <CardDescription>{t("settings.priceDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="priceBw">{t("settings.bwPrice")}</Label>
                <Input
                  id="priceBw"
                  type="number"
                  min="0"
                  value={priceBw}
                  onChange={(e) => setPriceBw(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {t("settings.current")}: {priceBw} ct ={" "}
                  {formatCurrency(parseInt(priceBw || "0", 10))}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="priceColor">{t("settings.colorPrice")}</Label>
                <Input
                  id="priceColor"
                  type="number"
                  min="0"
                  value={priceColor}
                  onChange={(e) => setPriceColor(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {t("settings.current")}: {priceColor} ct ={" "}
                  {formatCurrency(parseInt(priceColor || "0", 10))}
                </p>
              </div>
            </div>
            <Button onClick={handleSavePrices} disabled={savingPrices}>
              <Save className="h-4 w-4 mr-2" /> {t("settings.savePrices")}
            </Button>
          </CardContent>
        </Card>

        <Separator />

        {/* Supervisors */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{t("settings.supervisors")}</CardTitle>
              <CardDescription>
                {t("settings.manageSupervisors")}
              </CardDescription>
            </div>
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />{" "}
                  {t("settings.addSupervisor")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("settings.addSupervisor")}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="supUsername">{t("common.username")}</Label>
                    <Input
                      id="supUsername"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      placeholder={t("common.username")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="supPassword">{t("common.password")}</Label>
                    <Input
                      id="supPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder={t("common.password")}
                    />
                  </div>
                  <Button onClick={handleAddSupervisor} className="w-full">
                    {t("settings.createSupervisor")}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.username")}</TableHead>
                  <TableHead className="w-[80px]">
                    {t("common.actions")}
                  </TableHead>
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
                            ? t("settings.cannotDeleteSelf")
                            : t("settings.deleteSupervisor")
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
