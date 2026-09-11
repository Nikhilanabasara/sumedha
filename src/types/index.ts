export type Role = 'student' | 'admin';

export interface Grade {
  id: string;
  grade_name: string;
  display_order: number;
  created_at: string;
}

export interface Month {
  id: string;
  grade_id: string;
  month_name: string;
  year: number;
  is_locked: boolean;
  created_at: string;
}

export interface Profile {
  id: string;
  name: string;
  phone: string;
  role: Role;
  active_grade_id: string | null;
  created_at: string;
}

export interface QualityOption {
  label: string;
  url: string;
}

export interface Video {
  id: string;
  month_id: string;
  title: string;
  description: string;
  video_url: string;
  quality_urls: QualityOption[];
  duration: string;
  thumbnail_url: string;
  is_published: boolean;
  created_at: string;
}

export interface StudentAccess {
  id: string;
  user_id: string;
  month_id: string;
  has_access: boolean;
  created_at: string;
}

export type PaymentStatus = 'pending' | 'approved' | 'rejected';

export interface PaymentRequest {
  id: string;
  user_id: string;
  month_id: string;
  slip_url: string;
  status: PaymentStatus;
  admin_note: string;
  created_at: string;
  reviewed_at: string | null;
}
