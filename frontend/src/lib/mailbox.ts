import { Branch, Candidate } from "@/lib/api";

export type InboxItem = { id: string; first_name: string; last_name: string; email: string; position: string | null; status: string; branch: Branch | null; is_complete: boolean; latest_subject: string; last_activity_at: string; message_count: number; draft_count: number };
export type MailMessage = { id: string; candidate_id: string; direction: "inbound" | "outbound"; delivery_status: "received" | "draft"; sender: string; recipient: string; subject: string; body: string; source: "existing_source_email" | "sample_intake" | "sample_follow_up" | "reply_draft"; version: number; created_at: string; updated_at: string };
export type MailPage<T> = { data: T[]; current_page: number; last_page: number; total: number };
export type Conversation = { candidate: Candidate; mailbox: string; delivery_connected: false; messages: MailPage<MailMessage> };
