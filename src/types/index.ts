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
}

export interface Service {
  id: string;
  business_id: string;
  name: string;
  price: number;
  duration_minutes: number;
  created_at: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
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
  // Joined fields
  service_name?: string;
  service_price?: number;
  service_duration?: number;
  customer_name?: string;
  customer_phone?: string;
}

// ─── Enums & Value Types ──────────────────────────────

export type BookingStatus = "Booked" | "Cancelled" | "Completed";

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
  business: Omit<Business, "password_hash">;
}

export interface CreateServiceRequest {
  name: string;
  price: number;
  duration_minutes: number;
}

export interface CreateBookingRequest {
  service_id: string;
  date: string;
  time: string;
  customer_name: string;
  customer_phone: string;
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

// ─── API Error ────────────────────────────────────────

export interface ApiError {
  error: string;
  details?: string;
}
