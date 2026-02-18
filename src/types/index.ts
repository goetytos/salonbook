// ─── Database Row Types ────────────────────────────────

export interface Business {
  id: string;
  name: string;
  slug: string;
  email: string;
  password_hash: string;
  phone: string;
  location: string;
  working_hours: WorkingHours;
  created_at: string;
  // Booksy upgrade fields
  description?: string;
  cover_image_url?: string;
  avatar_url?: string;
  category?: string;
  social_links?: Record<string, string>;
  cancellation_hours?: number;
  deposit_required?: boolean;
  buffer_minutes?: number;
}

export interface Service {
  id: string;
  business_id: string;
  name: string;
  price: number;
  duration_minutes: number;
  created_at: string;
  // Booksy upgrade fields
  description?: string;
  buffer_minutes?: number;
  active?: boolean;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  password_hash?: string;
  created_at: string;
}

export interface Booking {
  id: string;
  business_id: string;
  service_id: string;
  customer_id: string;
  date: string;
  time: string;
  end_time: string;
  status: BookingStatus;
  created_at: string;
  // Booksy upgrade fields
  staff_id?: string;
  no_show?: boolean;
  notes?: string;
  promotion_id?: string;
  // Joined fields
  service_name?: string;
  service_price?: number;
  service_duration?: number;
  customer_name?: string;
  customer_phone?: string;
  business_name?: string;
  business_location?: string;
  staff_name?: string;
}

export interface Staff {
  id: string;
  business_id: string;
  name: string;
  email?: string;
  phone?: string;
  role: string;
  specialties: string[];
  avatar_url?: string;
  working_hours: WorkingHours;
  active: boolean;
  created_at: string;
  // Joined fields
  service_ids?: string[];
}

export interface Review {
  id: string;
  business_id: string;
  customer_id: string;
  booking_id?: string;
  staff_id?: string;
  rating: number;
  comment?: string;
  created_at: string;
  // Joined fields
  customer_name?: string;
  staff_name?: string;
  service_name?: string;
}

export interface ClientNote {
  id: string;
  business_id: string;
  customer_id: string;
  note: string;
  created_by?: string;
  created_at: string;
}

export interface ClientTag {
  id: string;
  business_id: string;
  name: string;
  color: string;
}

export interface BlockedDate {
  id: string;
  business_id: string;
  staff_id?: string;
  date: string;
  start_time?: string;
  end_time?: string;
  reason?: string;
  // Joined fields
  staff_name?: string;
}

export interface NotificationLog {
  id: string;
  type: string;
  recipient: string;
  channel: "sms" | "email" | "whatsapp";
  status: string;
  booking_id?: string;
  business_id?: string;
  payload?: Record<string, unknown>;
  error_msg?: string;
  sent_at: string;
}

export interface Promotion {
  id: string;
  business_id: string;
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  valid_from: string;
  valid_to: string;
  max_uses?: number;
  current_uses: number;
  applicable_services: string[];
  active: boolean;
  created_at: string;
}

// ─── Enums & Value Types ──────────────────────────────

export type BookingStatus = "Booked" | "Cancelled" | "Completed" | "No-Show";

export interface DaySchedule {
  open: string;  // e.g. "09:00"
  close: string; // e.g. "18:00"
  closed: boolean;
}

export interface WorkingHours {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

// ─── API Request/Response Types ───────────────────────

export interface SignupRequest {
  name: string;
  email: string;
  password: string;
  phone: string;
  location: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  role: "business" | "customer";
  business?: Omit<Business, "password_hash">;
  customer?: Omit<Customer, "password_hash">;
}

export interface CreateServiceRequest {
  name: string;
  price: number;
  duration_minutes: number;
  description?: string;
}

export interface CreateBookingRequest {
  service_id: string;
  date: string;
  time: string;
  customer_name: string;
  customer_phone: string;
  staff_id?: string;
  notes?: string;
  promotion_code?: string;
}

export interface CreateStaffRequest {
  name: string;
  email?: string;
  phone?: string;
  role?: string;
  specialties?: string[];
  avatar_url?: string;
  service_ids?: string[];
}

export interface CreateReviewRequest {
  booking_id: string;
  rating: number;
  comment?: string;
  staff_id?: string;
}

export interface CreatePromotionRequest {
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  valid_from: string;
  valid_to: string;
  max_uses?: number;
  applicable_services?: string[];
}

export interface TimeSlot {
  time: string;
  available: boolean;
}

export interface DashboardStats {
  total_bookings: number;
  today_bookings: number;
  upcoming_bookings: number;
  monthly_bookings: number;
  total_customers: number;
  monthly_revenue: number;
}

export interface AnalyticsData {
  period: string;
  revenue: { date: string; amount: number }[];
  bookings: { date: string; count: number }[];
  popular_services: { name: string; count: number }[];
  peak_hours: { hour: number; count: number }[];
  total_revenue: number;
  total_bookings: number;
  avg_rating: number;
  new_customers: number;
}

export interface BusinessPublicProfile {
  id: string;
  name: string;
  slug: string;
  phone: string;
  location: string;
  description?: string;
  cover_image_url?: string;
  avatar_url?: string;
  category?: string;
  social_links?: Record<string, string>;
  working_hours: WorkingHours;
  services: Service[];
  staff: Staff[];
  avg_rating: number;
  review_count: number;
}

// ─── API Error ────────────────────────────────────────

export interface ApiError {
  error: string;
  details?: string;
}
