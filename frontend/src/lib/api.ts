export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001/api";

export type CandidateStatus = string;

export type RecruitmentStatus = {
  code: string; label_pl: string; label_en: string; color: string;
  sort_order: number; is_active: boolean;
};

export type Branch = {
  id: number;
  city: string;
  name: string;
};

export type FollowUpEmail = {
  status: "draft_only" | "not_needed";
  recipient: string;
  subject: string | null;
  body: string | null;
  missing_information: string[];
};

export type Candidate = {
  id: string;
  applicant_id?: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  position: string | null;
  branch: Branch | null;
  status: CandidateStatus;
  hr_notes: string;
  source: string;
  email_subject?: string | null;
  email_body?: string | null;
  missing_information: string[];
  is_complete: boolean;
  follow_up_email: FollowUpEmail;
  cv_validation_error: string | null;
  cv_original_filename: string | null;
  created_at: string;
  updated_at: string;
};

export type CandidatePage = {
  items: Candidate[];
  total: number;
  limit: number;
  offset: number;
};

export type Dashboard = {
  needs_information: number;
  conversations: number | null;
  reply_drafts: number | null;
  unassigned: number;
  total: number;
  by_status: Record<CandidateStatus, number>;
  by_branch: {
    branch_id: number;
    city: string;
    total: number;
  }[];
};

export async function apiGet<T>(
  path: string,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    throw new Error("Nie udało się pobrać danych. Spróbuj ponownie.");
  }

  return response.json();
}

export type DemoContext = {
  employee: DemoEmployee | null;
  role: string;
  role_definition: RecruitmentRole;
  permissions: string[];
  scope: "all" | "branch";
  branch_id: number | null;
  simulation: boolean;
  branches: Branch[];
};

export type RecruitmentRole = {
  code: string; label_pl: string; label_en: string; scope: "all" | "branch";
  permissions: string[]; is_builtin: boolean; is_active: boolean; updated_at?: string;
};
export type PermissionDefinition = { code: string; label_pl: string; label_en: string };
export type DemoEmployee = { id: string; name: string; email: string; role_code?: string; branch_id?: number | null };
export type DemoCatalog = { employees: DemoEmployee[]; roles: RecruitmentRole[]; branches: Branch[]; simulation: boolean };
