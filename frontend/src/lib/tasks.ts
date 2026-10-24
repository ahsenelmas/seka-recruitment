import { DemoEmployee } from "@/lib/api";
import { MailPage } from "@/lib/mailbox";
export type WorkTask = { id: string; title: string; description: string | null; due_on: string | null; status: "open" | "done" | "cancelled"; version: number; assignee_employee_id: string | null; assignee: DemoEmployee | null; assignment_valid: boolean; is_overdue: boolean; can_complete: boolean; candidate: { id: string; name: string; city: string | null } };
export type ApplicationWorkData = { owner_employee_id: string | null; owner: DemoEmployee | null; owner_valid: boolean; follow_up_on: string | null; work_version: number; employees: DemoEmployee[]; tasks: MailPage<WorkTask> };
export const taskLabel = (status: WorkTask["status"], pl: boolean) => ({ open: pl?"Otwarte":"Open", done: pl?"Wykonane":"Done", cancelled: pl?"Anulowane":"Cancelled" })[status];
