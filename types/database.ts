// Centralised TypeScript types for all Supabase tables and shared enums.
// Update this file whenever the database schema changes.

// ── Enums ──────────────────────────────────────────────────────────────────────

export type UserRole =
  | 'global_admin'
  | 'company_admin'
  | 'manager'
  | 'ap'           // Appointed Person
  | 'supervisor'   // Crane Supervisor
  | 'crane_operator'
  | 'subcontractor'
  | 'slinger';     // Slinger/Signaller

export type CraneStatus = 'active' | 'idle' | 'out_of_service';

export type FormStatus = 'draft' | 'submitted';

// ── Core entities ──────────────────────────────────────────────────────────────

export interface Company {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Site {
  id: string;
  company_id: string;
  name: string;
  address: string;
  postcode: string;
  created_at: string;
  companies?: Company;
}

/** Row in the public.users table (not auth.users). */
export interface UserProfile {
  id: string;
  supabase_auth_uid: string | null;
  name: string;
  email: string;
  phone: string | null;
  cpcs_number: string;
  role: UserRole;
  company_id: string;
  site_id: string | null;
  /** @deprecated legacy field */
  subcontractor_id?: string | null;
  is_activated: boolean;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  // Joined relations (optional)
  companies?: Company;
  sites?: Site;
}

export interface Crane {
  id: string;
  site_id: string;
  company_id: string;
  name: string;
  model: string | null;
  serial_number: string | null;
  status: CraneStatus;
  is_active: boolean;
  created_at: string;
  sites?: Site;
}

export interface RescueKit {
  id: string;
  site_id: string;
  company_id: string;
  name: string;
  location: string | null;
  is_active: boolean;
  created_at: string;
  sites?: Site;
}

// ── Form types ─────────────────────────────────────────────────────────────────

export interface CraneLog {
  id: string;
  site_id: string;
  company_id: string;
  crane_id: string;
  submitted_by: string;
  log_date: string;
  start_time: string;
  end_time: string | null;
  status: FormStatus | LogStatus; // union supports both old and new schemas
  activity: string;
  wind_speed: number | null;
  notes: string | null;
  created_at: string;
  cranes?: Crane;
  users?: UserProfile;
  // Legacy optional fields from old schema
  /** @deprecated */
  subcontractors?: Subcontractor;
  /** @deprecated use activity */
  details?: string | null;
  /** @deprecated */
  image_url?: string | null;
}

export interface CraneSchedule {
  id: string;
  site_id: string;
  company_id: string;
  crane_id: string;
  submitted_by: string;
  schedule_date: string;
  planned_lifts: string;
  notes: string | null;
  status: FormStatus;
  created_at: string;
  cranes?: Crane;
  users?: UserProfile;
}

export interface DailyBriefing {
  id: string;
  site_id: string;
  company_id: string;
  submitted_by: string;
  briefing_date: string;
  weather_conditions: string;
  hazards: string;
  work_planned: string;
  ppe_requirements: string;
  notes: string | null;
  status: FormStatus;
  created_at: string;
  users?: UserProfile;
}

export interface BriefingSignature {
  id: string;
  briefing_id: string;
  user_id: string;
  signed_at: string;
  users?: UserProfile;
}

export interface ToolboxTalk {
  id: string;
  site_id: string;
  company_id: string;
  submitted_by: string;
  talk_date: string;
  topic: string;
  content: string;
  notes: string | null;
  status: FormStatus;
  created_at: string;
  users?: UserProfile;
}

export interface ToolboxSignature {
  id: string;
  toolbox_talk_id: string;
  user_id: string;
  signed_at: string;
  users?: UserProfile;
}

export interface LolerCheck {
  id: string;
  site_id: string;
  company_id: string;
  crane_id: string;
  submitted_by: string;
  check_date: string;
  thorough_examination_date: string | null;
  next_examination_date: string | null;
  defects_found: boolean;
  defect_details: string | null;
  is_safe_to_use: boolean;
  notes: string | null;
  status: FormStatus;
  created_at: string;
  cranes?: Crane;
  users?: UserProfile;
}

export interface HookBlockRadioCheck {
  id: string;
  site_id: string;
  company_id: string;
  crane_id: string;
  submitted_by: string;
  check_date: string;
  hook_block_ok: boolean;
  radio_ok: boolean;
  defect_details: string | null;
  notes: string | null;
  status: FormStatus;
  created_at: string;
  cranes?: Crane;
  users?: UserProfile;
}

export interface OutOfServiceReport {
  id: string;
  site_id: string;
  company_id: string;
  crane_id: string;
  submitted_by: string;
  report_date: string;
  reason: string;
  is_resolved: boolean;
  resolved_at: string | null;
  notes: string | null;
  status: FormStatus;
  created_at: string;
  cranes?: Crane;
  users?: UserProfile;
}

export interface ZoningAntiCollisionCheck {
  id: string;
  site_id: string;
  company_id: string;
  crane_id: string;
  submitted_by: string;
  check_date: string;
  zoning_ok: boolean;
  anti_collision_ok: boolean;
  defect_details: string | null;
  notes: string | null;
  status: FormStatus;
  created_at: string;
  cranes?: Crane;
  users?: UserProfile;
}

export interface FitForWorkCheck {
  id: string;
  site_id: string;
  company_id: string;
  submitted_by: string;
  check_date: string;
  check_time: string;
  feeling_well: boolean;
  on_medication: boolean;
  medication_detail: string | null;
  alcohol_drugs_free: boolean;
  fit_to_operate: boolean;
  notes: string | null;
  status: FormStatus;
  created_at: string;
  users?: UserProfile;
}

export interface RescueKitCheck {
  id: string;
  site_id: string;
  company_id: string;
  rescue_kit_id: string;
  submitted_by: string;
  check_date: string;
  all_items_present: boolean;
  items_in_date: boolean;
  defect_details: string | null;
  notes: string | null;
  status: FormStatus;
  created_at: string;
  rescue_kits?: RescueKit;
  users?: UserProfile;
}

export interface HiabCheck {
  id: string;
  site_id: string;
  company_id: string;
  crane_id: string;
  submitted_by: string;
  check_date: string;
  structural_ok: boolean;
  hydraulics_ok: boolean;
  controls_ok: boolean;
  defect_details: string | null;
  notes: string | null;
  status: FormStatus;
  created_at: string;
  cranes?: Crane;
  users?: UserProfile;
}

export interface SpotCheck {
  id: string;
  site_id: string;
  company_id: string;
  submitted_by: string;
  check_date: string;
  operatives_briefed: boolean;
  ppe_compliant: boolean;
  exclusion_zones_clear: boolean;
  notes: string | null;
  status: FormStatus;
  created_at: string;
  users?: UserProfile;
}

// ── Legacy types (kept for backwards compatibility with existing screens) ────────

/** @deprecated Use UserRole instead */
export type LogStatus = 'Working' | 'Service' | 'Thorough Examination' | 'Breaking Down' | 'Wind Off';

// Legacy CraneStatus values used by the old logs/bookings screens.
/** @deprecated */
export type LegacyCraneStatus = 'available' | 'in_use' | 'maintenance' | 'offline';

/** @deprecated Use UserProfile instead */
export interface Subcontractor {
  id: string;
  name: string;
  company: string;
  site_id: string | null;
  created_at: string;
}

/** @deprecated Use CraneLog instead */
export interface CraneBooking {
  id: string;
  crane_id: string;
  subcontractor_id: string;
  site_id: string;
  job_details: string | null;
  start_time: string;
  end_time: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  cranes?: Crane;
  subcontractors?: Subcontractor;
  sites?: Site;
}

/** @deprecated Use Crane instead */
export interface Inspection {
  id: string;
  crane_id: string;
  user_id: string;
  date: string;
  checklist_json: Record<string, boolean>;
  passed: boolean;
  created_at: string;
  cranes?: Crane;
  users?: UserProfile;
}
