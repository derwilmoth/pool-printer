/**
 * Print Middleware Script
 *
 * This script polls the Windows Print Spooler for paused jobs,
 * communicates with the Next.js API to reserve/confirm/cancel prints,
 * and manages print job lifecycle.
 *
 * Usage:
 *   npx ts-node print-middleware/index.ts
 *   or: node print-middleware/index.js (after compiling)
 *
 * Environment variables:
 *   API_URL    - Next.js API base URL (default: http://localhost:3000)
 *   API_KEY    - API key matching the Next.js backend
 *   POLL_INTERVAL - Polling interval in ms (default: 3000)
 *   PRINTER_SW - B&W printer name (default: PoolDrucker_SW)
 *   PRINTER_COLOR - Color printer name (default: PoolDrucker_Farbe)
 */

import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// Configuration
const API_URL = process.env.API_URL || "http://localhost:3000";
const API_KEY = process.env.API_KEY || "pool-printer-api-key-change-in-production";
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || "3000", 10);
const PRINTER_SW = process.env.PRINTER_SW || "PoolDrucker_SW";
const PRINTER_COLOR = process.env.PRINTER_COLOR || "PoolDrucker_Farbe";

// In-memory tracking of active print jobs
interface TrackedJob {
  jobId: number;
  transactionId: number | null;
  printerName: string;
  userId: string;
  isFree: boolean;
  resumedAt: number;
}

const trackedJobs = new Map<string, TrackedJob>(); // key: "printerName:jobId"

interface PrintJob {
  Id: number;
  JobId?: number;
  DocumentName: string;
  UserName: string;
  PrinterName: string;
  TotalPages: number;
  PagesPrinted: number;
  JobStatus: string;
}

async function apiRequest(path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(body),
  });
  return (await res.json()) as Record<string, unknown>;
}

function getPrinterType(printerName: string): "sw" | "color" {
  if (printerName.toLowerCase().includes("farbe") || printerName.toLowerCase().includes("color")) {
    return "color";
  }
  return "sw";
}

function jobKey(printerName: string, jobId: number): string {
  return `${printerName}:${jobId}`;
}

async function getPausedJobs(): Promise<PrintJob[]> {
  try {
    const cmd = `Get-PrintJob -PrinterName "${PRINTER_SW}", "${PRINTER_COLOR}" | Where-Object { $_.JobStatus -match "Paused" } | Select-Object Id, DocumentName, UserName, PrinterName, TotalPages, PagesPrinted, JobStatus | ConvertTo-Json -Depth 3`;
    const { stdout } = await execAsync(`powershell -NoProfile -Command "${cmd.replace(/"/g, '\\"')}"`);

    if (!stdout.trim()) return [];

    const parsed = JSON.parse(stdout.trim());
    // PowerShell returns a single object if only one result, array if multiple
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (error) {
    // Printer might not exist or no jobs
    return [];
  }
}

async function getJobStatus(printerName: string, jobId: number): Promise<string | null> {
  try {
    const cmd = `Get-PrintJob -PrinterName "${printerName}" -ID ${jobId} | Select-Object -ExpandProperty JobStatus`;
    const { stdout } = await execAsync(`powershell -NoProfile -Command "${cmd.replace(/"/g, '\\"')}"`);
    return stdout.trim() || null;
  } catch {
    return null; // Job likely no longer exists (completed/removed)
  }
}

async function resumeJob(printerName: string, jobId: number): Promise<void> {
  const cmd = `Resume-PrintJob -PrinterName "${printerName}" -ID ${jobId}`;
  await execAsync(`powershell -NoProfile -Command "${cmd.replace(/"/g, '\\"')}"`);
}

async function removeJob(printerName: string, jobId: number): Promise<void> {
  try {
    const cmd = `Remove-PrintJob -PrinterName "${printerName}" -ID ${jobId} -ErrorAction SilentlyContinue`;
    await execAsync(`powershell -NoProfile -Command "${cmd.replace(/"/g, '\\"')}"`);
  } catch {
    // Job may already be gone
  }
}

async function cancelJob(printerName: string, jobId: number): Promise<void> {
  try {
    const cmd = `Remove-PrintJob -PrinterName "${printerName}" -ID ${jobId} -ErrorAction SilentlyContinue`;
    await execAsync(`powershell -NoProfile -Command "${cmd.replace(/"/g, '\\"')}"`);
  } catch {
    // Job may already be gone
  }
}

async function handlePausedJobs(): Promise<void> {
  const pausedJobs = await getPausedJobs();

  for (const job of pausedJobs) {
    const id = job.Id || job.JobId;
    if (!id) continue;

    const key = jobKey(job.PrinterName, id);

    // Skip if already tracked (already being processed)
    if (trackedJobs.has(key)) continue;

    const printerType = getPrinterType(job.PrinterName);
    const pages = job.TotalPages || 1;
    const userId = job.UserName || "unknown";

    console.log(`[NEW] Paused job #${id} from ${userId} on ${job.PrinterName} (${pages} pages, ${printerType})`);

    try {
      // Call reserve API
      const result = await apiRequest("/api/print/reserve", {
        userId,
        pages,
        printerType,
      });

      if (result.allowed) {
        // Resume the print job
        await resumeJob(job.PrinterName, id);

        const tracked: TrackedJob = {
          jobId: id,
          transactionId: (result.transactionId as number) || null,
          printerName: job.PrinterName,
          userId,
          isFree: !!result.isFree,
          resumedAt: Date.now(),
        };

        trackedJobs.set(key, tracked);
        console.log(
          `[RESUMED] Job #${id} - ${result.isFree ? "FREE" : `Transaction #${result.transactionId}`}`
        );
      } else {
        // Not allowed - cancel the job
        console.log(`[DENIED] Job #${id} from ${userId}: ${result.reason}`);
        await cancelJob(job.PrinterName, id);
      }
    } catch (error) {
      console.error(`[ERROR] Failed to process job #${id}:`, error);
    }
  }
}

async function checkTrackedJobs(): Promise<void> {
  for (const [key, tracked] of trackedJobs.entries()) {
    try {
      const status = await getJobStatus(tracked.printerName, tracked.jobId);

      if (status === null) {
        // Job no longer exists - likely printed successfully
        if (tracked.transactionId && !tracked.isFree) {
          await apiRequest("/api/print/confirm", { transactionId: tracked.transactionId });
          console.log(`[COMPLETED] Job #${tracked.jobId} - Transaction #${tracked.transactionId} confirmed`);
        } else {
          console.log(`[COMPLETED] Job #${tracked.jobId} (free account)`);
        }
        trackedJobs.delete(key);
        continue;
      }

      // Check for printed/completed status
      if (status.match(/Printed|Completed|Sent/i)) {
        if (tracked.transactionId && !tracked.isFree) {
          await apiRequest("/api/print/confirm", { transactionId: tracked.transactionId });
          console.log(`[CONFIRMED] Job #${tracked.jobId} - Status: ${status}`);
        }
        // Try to clean up the job
        await removeJob(tracked.printerName, tracked.jobId);
        trackedJobs.delete(key);
        continue;
      }

      // Check for error status
      if (status.match(/Error|Offline|PaperOut|Deleting/i)) {
        if (tracked.transactionId && !tracked.isFree) {
          await apiRequest("/api/print/cancel", { transactionId: tracked.transactionId });
          console.log(`[CANCELLED] Job #${tracked.jobId} - Error: ${status}, refunded`);
        }
        await cancelJob(tracked.printerName, tracked.jobId);
        trackedJobs.delete(key);
        continue;
      }

      // Check for timeout (5 minutes)
      const elapsed = Date.now() - tracked.resumedAt;
      if (elapsed > 5 * 60 * 1000) {
        console.log(`[TIMEOUT] Job #${tracked.jobId} - Stuck for ${Math.round(elapsed / 1000)}s`);
        if (tracked.transactionId && !tracked.isFree) {
          await apiRequest("/api/print/cancel", { transactionId: tracked.transactionId });
          console.log(`[REFUNDED] Job #${tracked.jobId} - Timed out, refunded`);
        }
        await cancelJob(tracked.printerName, tracked.jobId);
        trackedJobs.delete(key);
      }
    } catch (error) {
      console.error(`[ERROR] Checking tracked job #${tracked.jobId}:`, error);
    }
  }
}

async function poll(): Promise<void> {
  try {
    await handlePausedJobs();
    await checkTrackedJobs();
  } catch (error) {
    console.error("[POLL ERROR]", error);
  }
}

// Main entry point
console.log("=== Print Middleware Starting ===");
console.log(`API URL: ${API_URL}`);
console.log(`Printers: ${PRINTER_SW}, ${PRINTER_COLOR}`);
console.log(`Poll interval: ${POLL_INTERVAL}ms`);
console.log("================================\n");

// Initial poll
poll();

// Set up interval
setInterval(poll, POLL_INTERVAL);

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\nShutting down print middleware...");
  if (trackedJobs.size > 0) {
    console.log(`Warning: ${trackedJobs.size} tracked jobs still in progress`);
  }
  process.exit(0);
});
