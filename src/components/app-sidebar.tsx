"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import { useI18n } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Users,
  FileText,
  Settings,
  LogOut,
  Printer,
  Sun,
  Moon,
  Monitor,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navItems: {
  titleKey: TranslationKey;
  href: string;
  icon: typeof LayoutDashboard;
}[] = [
  { titleKey: "nav.dashboard", href: "/dashboard", icon: LayoutDashboard },
  { titleKey: "nav.users", href: "/users", icon: Users },
  { titleKey: "nav.jobs", href: "/jobs", icon: FileText },
  { titleKey: "nav.settings", href: "/settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { t, locale, setLocale } = useI18n();
  const { setTheme, theme } = useTheme();

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-6 py-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Printer className="h-6 w-6 text-primary" />
          <span className="text-lg font-bold">{t("app.name")}</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("nav.navigation")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={pathname === item.href}>
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{t(item.titleKey)}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t p-4 space-y-2">
        {/* Language & Theme Controls */}
        <div className="flex gap-1 px-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title={t("nav.language")}
              >
                <Globe className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                onClick={() => setLocale("de")}
                className={locale === "de" ? "font-bold" : ""}
              >
                🇩🇪 Deutsch
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setLocale("en")}
                className={locale === "en" ? "font-bold" : ""}
              >
                🇬🇧 English
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title={t("nav.theme")}
              >
                <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                onClick={() => setTheme("light")}
                className={theme === "light" ? "font-bold" : ""}
              >
                <Sun className="h-4 w-4 mr-2" /> {t("nav.light")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setTheme("dark")}
                className={theme === "dark" ? "font-bold" : ""}
              >
                <Moon className="h-4 w-4 mr-2" /> {t("nav.dark")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setTheme("system")}
                className={theme === "system" ? "font-bold" : ""}
              >
                <Monitor className="h-4 w-4 mr-2" /> {t("nav.system")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {session?.user?.name && (
          <p className="text-sm text-muted-foreground px-2 truncate">
            {t("nav.signedInAs")}{" "}
            <span className="font-medium text-foreground">
              {session.user.name}
            </span>
          </p>
        )}
        <Button
          variant="ghost"
          className="w-full justify-start gap-2"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="h-4 w-4" />
          {t("nav.logout")}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
