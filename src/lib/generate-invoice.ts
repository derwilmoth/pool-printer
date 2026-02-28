import { jsPDF } from "jspdf";
import type { Locale } from "@/lib/i18n";

interface InvoiceData {
  id: number;
  userId: string;
  amount: number; // in cents
  pages: number | null;
  type: string;
  status: string;
  timestamp: string;
}

// --- Environment-based company config ---
function getInvoiceConfig() {
  return {
    companyName: process.env.NEXT_PUBLIC_INVOICE_COMPANY_NAME ?? "",
    companyAddress: process.env.NEXT_PUBLIC_INVOICE_COMPANY_ADDRESS ?? "",
    companyPhone: process.env.NEXT_PUBLIC_INVOICE_COMPANY_PHONE ?? "",
    companyEmail: process.env.NEXT_PUBLIC_INVOICE_COMPANY_EMAIL ?? "",
    taxId: process.env.NEXT_PUBLIC_INVOICE_TAX_ID ?? "",
    taxRate: Number(process.env.NEXT_PUBLIC_INVOICE_TAX_RATE ?? "0"),
    currency: process.env.NEXT_PUBLIC_INVOICE_CURRENCY ?? "EUR",
  };
}

const labels: Record<
  Locale,
  {
    title: string;
    invoiceNr: string;
    date: string;
    user: string;
    type: string;
    status: string;
    pages: string;
    netAmount: string;
    tax: string;
    grossAmount: string;
    amount: string;
    deposit: string;
    printBw: string;
    printColor: string;
    completed: string;
    pending: string;
    refunded: string;
    failed: string;
    footer: string;
    generatedAt: string;
    taxIdLabel: string;
    phone: string;
    email: string;
  }
> = {
  de: {
    title: "Beleg",
    invoiceNr: "Beleg-Nr.",
    date: "Datum",
    user: "Benutzer",
    type: "Typ",
    status: "Status",
    pages: "Seiten",
    netAmount: "Nettobetrag",
    tax: "MwSt.",
    grossAmount: "Bruttobetrag",
    amount: "Betrag",
    deposit: "Einzahlung",
    printBw: "Druck (S/W)",
    printColor: "Druck (Farbe)",
    completed: "Abgeschlossen",
    pending: "Ausstehend",
    refunded: "Erstattet",
    failed: "Fehlgeschlagen",
    footer: "Automatisch generierter Beleg",
    generatedAt: "Erstellt am",
    taxIdLabel: "Steuer-Nr.",
    phone: "Tel.",
    email: "E-Mail",
  },
  en: {
    title: "Receipt",
    invoiceNr: "Receipt No.",
    date: "Date",
    user: "User",
    type: "Type",
    status: "Status",
    pages: "Pages",
    netAmount: "Net amount",
    tax: "VAT",
    grossAmount: "Gross amount",
    amount: "Amount",
    deposit: "Deposit",
    printBw: "Print (B&W)",
    printColor: "Print (Color)",
    completed: "Completed",
    pending: "Pending",
    refunded: "Refunded",
    failed: "Failed",
    footer: "Automatically generated receipt",
    generatedAt: "Generated on",
    taxIdLabel: "Tax ID",
    phone: "Phone",
    email: "Email",
  },
};

function formatCurrency(
  cents: number,
  locale: Locale,
  currency: string,
): string {
  return new Intl.NumberFormat(locale === "de" ? "de-DE" : "en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

function formatDateTime(dateStr: string, locale: Locale): string {
  const d = new Date(dateStr);
  return d.toLocaleString(locale === "de" ? "de-DE" : "en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getTypeLabel(type: string, l: (typeof labels)[Locale]): string {
  switch (type) {
    case "deposit":
      return l.deposit;
    case "print_sw":
      return l.printBw;
    case "print_color":
      return l.printColor;
    default:
      return type;
  }
}

function getStatusLabel(status: string, l: (typeof labels)[Locale]): string {
  switch (status) {
    case "completed":
      return l.completed;
    case "pending":
      return l.pending;
    case "refunded":
      return l.refunded;
    case "failed":
      return l.failed;
    default:
      return status;
  }
}

export function generateInvoicePDF(tx: InvoiceData, locale: Locale): void {
  const l = labels[locale];
  const cfg = getInvoiceConfig();
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  // --- Company Header (top-right) ---
  let headerY = 20;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);

  if (cfg.companyName) {
    doc.text(cfg.companyName, pageWidth - margin, headerY, { align: "right" });
    headerY += 6;
  }

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);

  if (cfg.companyAddress) {
    // Support multi-line address via "|" separator
    const addressLines = cfg.companyAddress.split("|").map((s) => s.trim());
    for (const line of addressLines) {
      doc.text(line, pageWidth - margin, headerY, { align: "right" });
      headerY += 4;
    }
  }

  if (cfg.companyPhone) {
    doc.text(`${l.phone} ${cfg.companyPhone}`, pageWidth - margin, headerY, {
      align: "right",
    });
    headerY += 4;
  }

  if (cfg.companyEmail) {
    doc.text(`${l.email} ${cfg.companyEmail}`, pageWidth - margin, headerY, {
      align: "right",
    });
    headerY += 4;
  }

  if (cfg.taxId) {
    doc.text(`${l.taxIdLabel} ${cfg.taxId}`, pageWidth - margin, headerY, {
      align: "right",
    });
    headerY += 4;
  }

  // --- Title (top-left) ---
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text(l.title, margin, 30);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  doc.text(`${l.invoiceNr} ${tx.id}`, margin, 37);

  // --- Separator ---
  const separatorY = Math.max(headerY + 2, 44);
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(margin, separatorY, pageWidth - margin, separatorY);

  // --- Details ---
  let y = separatorY + 12;
  const lineHeight = 10;

  const drawRow = (label: string, value: string) => {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(80, 80, 80);
    doc.setFontSize(11);
    doc.text(label, margin, y);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 30, 30);
    doc.text(value, margin + 50, y);

    y += lineHeight;
  };

  drawRow(l.invoiceNr, String(tx.id));
  drawRow(l.date, formatDateTime(tx.timestamp, locale));
  drawRow(l.user, tx.userId);
  drawRow(l.type, getTypeLabel(tx.type, l));
  drawRow(l.status, getStatusLabel(tx.status, l));

  if (tx.pages && tx.pages > 0) {
    drawRow(l.pages, String(tx.pages));
  }

  // --- Amount section ---
  y += 5;
  const absCents = Math.abs(tx.amount);

  if (cfg.taxRate > 0) {
    // With tax: show net, tax, gross
    const netCents = Math.round(absCents / (1 + cfg.taxRate / 100));
    const taxCents = absCents - netCents;

    // Net
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(80, 80, 80);
    doc.text(l.netAmount, margin + 5, y);
    doc.setTextColor(30, 30, 30);
    doc.text(formatCurrency(netCents, locale, cfg.currency), pageWidth - margin - 5, y, {
      align: "right",
    });
    y += 7;

    // Tax
    doc.setTextColor(80, 80, 80);
    doc.text(`${l.tax} (${cfg.taxRate}%)`, margin + 5, y);
    doc.setTextColor(30, 30, 30);
    doc.text(formatCurrency(taxCents, locale, cfg.currency), pageWidth - margin - 5, y, {
      align: "right",
    });
    y += 7;

    // Gross (highlighted)
    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(245, 245, 250);
    doc.roundedRect(margin, y - 5, contentWidth, 14, 2, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(30, 30, 30);
    doc.text(l.grossAmount, margin + 5, y + 4);
    doc.text(
      formatCurrency(absCents, locale, cfg.currency),
      pageWidth - margin - 5,
      y + 4,
      { align: "right" },
    );
  } else {
    // Without tax: show single amount
    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(245, 245, 250);
    doc.roundedRect(margin, y - 6, contentWidth, 14, 2, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(30, 30, 30);
    doc.text(l.amount, margin + 5, y + 3);
    doc.text(
      formatCurrency(absCents, locale, cfg.currency),
      pageWidth - margin - 5,
      y + 3,
      { align: "right" },
    );
  }

  // --- Footer ---
  const footerY = doc.internal.pageSize.getHeight() - 20;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);

  const footerText = cfg.companyName
    ? `${l.footer} – ${cfg.companyName}`
    : `${l.footer} – Pool Printer`;
  doc.text(footerText, margin, footerY);
  doc.text(
    `${l.generatedAt}: ${formatDateTime(new Date().toISOString(), locale)}`,
    pageWidth - margin,
    footerY,
    { align: "right" },
  );

  if (cfg.taxId) {
    doc.text(`${l.taxIdLabel} ${cfg.taxId}`, margin, footerY + 4);
  }

  // --- Download ---
  const fileName = `${l.title.toLowerCase()}_${tx.id}_${tx.userId}.pdf`;
  doc.save(fileName);
}
