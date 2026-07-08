const BASE = process.env.NEXT_PUBLIC_API_URL;
if (!BASE) throw new Error('NEXT_PUBLIC_API_URL is not set');

type RequestOptions = {
  method?: string;
  body?:   unknown;
  token?:  string;
};

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`;

  const res = await fetch(`${BASE}${path}`, {
    method:  opts.method ?? 'GET',
    headers,
    body:    opts.body ? JSON.stringify(opts.body) : undefined,
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.message ?? 'Request failed');
  return json.data as T;
}

export interface OperationalCity {
  id: string; name: string; code: string; province: string; region: string;
}

export const publicApi = {
  getOperationalCities: () => request<OperationalCity[]>('/public/operational-cities'),
  getRoutes:       ()                      => request<Route[]>('/public/routes'),
  getProducts:     (q?: ProductsQuery)     => request<PublicProduct[]>(`/public/products${q ? '?' + new URLSearchParams(q as unknown as Record<string,string>) : ''}`),
  getProductSlots: (productId: string)     => request<ProductSlot[]>(`/public/products/${productId}/slots`),
  searchFlights:   (q: FlightSearchQuery)  => request<PublicFlight[]>(`/public/flights?${new URLSearchParams(q as unknown as Record<string,string>)}`),
  getSlotDetail:   (id: string)            => request<SlotDetail>(`/public/slots/${id}`),
  trackBooking:    (pnr: string, email?: string) => {
    const p = new URLSearchParams({ pnr });
    if (email) p.set('email', email);
    return request<TrackResult>(`/public/bookings/track?${p}`);
  },
  createBooking: (token: string, body: WalkInBookingInput) =>
    request<{ bookingId: string; pnr: string; status: string; holdExpiresAt: string; totalAmountUsd: number; passengers: number }>(
      '/public/bookings', { method: 'POST', body, token }
    ),
  createPaymentIntent: (token: string, bookingId: string) =>
    request<{ clientSecret: string; paymentIntentId: string; amountUsd: number }>(
      `/public/bookings/${bookingId}/payment-intent`, { method: 'POST', token }
    ),
  getPaymentStatus: (token: string, bookingId: string) =>
    request<{ status: string; pnr: string; totalAmountUsd: number; holdExpiresAt?: string }>(
      `/public/bookings/${bookingId}/payment-status`, { token }
    ),
};

export const customerApi = {
  requestOtp:  (email: string, name?: string, phone?: string) =>
    request('/customer/auth/request-otp', { method: 'POST', body: { email, name, phone } }),
  verifyOtp:   (email: string, otp: string) =>
    request<{ accessToken: string; customer: CustomerProfile }>('/customer/auth/verify-otp', { method: 'POST', body: { email, otp } }),
  me:          (token: string) => request<CustomerProfile>('/customer/me', { token }),
  updateMe:    (token: string, data: Partial<CustomerProfile>) =>
    request('/customer/me', { method: 'PATCH', body: data, token }),
  getBookings: (token: string) => request<CustomerBooking[]>('/customer/bookings', { token }),
  getBooking:  (token: string, pnr: string) => request<CustomerBooking>(`/customer/bookings/${pnr}`, { token }),
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Route {
  id: string; routeCode: string; origin: string; destination: string; distanceKm: number | null;
}

export interface ProductsQuery { routeId?: string; productType?: 'HELICOPTER' | 'FIXED_WING'; }

export interface PublicProduct {
  id:          string;
  productCode: string;
  name:        string;
  productType: string;
  pricingType: string;
  route:       { origin: string; destination: string };
}

export interface ProductSlot {
  id:                 string;
  slotCode:           string;
  scheduledDeparture: string;
  scheduledArrival:   string;
  availableSeats:     number;
  pricePerSeat:       number | null;
  quoteId?:           string;
  aircraft:           { name: string; saleableSeats: number };
  operatorName:       string | null;
  operatorLogo:       string | null;
}

export interface FlightSearchQuery {
  origin:      string;
  destination: string;
  date?:       string;
}

export interface PublicFlight {
  id:                 string;
  slotCode:           string;
  scheduledDeparture: string;
  scheduledArrival:   string;
  availableSeats:     number;
  durationMinutes:    number | null;
  pricePerSeat:       number | null;
  quoteId?:           string;
  origin:             string;
  destination:        string;
  distanceKm:         number | null;
  aircraft: {
    name:           string;
    registrationNo: string;
    speedKmh:       number | null;
  };
  operatorName: string | null;
  operatorLogo: string | null;
}

export interface SeatInfo {
  id:         string;
  seatNumber: string;
  row:        number;
  column:     string;
  seatX:      number | null;
  seatY:      number | null;
  isTaken:    boolean;
}

export interface SlotDetail {
  id:                 string;
  slotCode:           string;
  scheduledDeparture: string;
  scheduledArrival:   string;
  availableSeats:     number;
  origin:             string;
  destination:        string;
  distanceKm:         number | null;
  aircraft:     { name: string; registrationNo: string; type: string; saleableSeats: number; speedKmh: number | null };
  operatorName: string | null;
  operatorLogo: string | null;
  product: {
    id:            string;
    name:          string;
    description:   string | null;
    pricingType:   string;
    cutoffMinutes: number;
    addOns:        { id: string; label: string; baggageType: string; priceUsd: number; isIncluded: boolean }[];
  } | null;
  seatMap: {
    lopaImageUrl: string | null;
    seats:        SeatInfo[];
  } | null;
}

export interface TrackResult {
  pnr:             string;
  status:          string;
  totalPassengers: number;
  totalAmountUsd:  number;
  departure:       string;
  arrival:         string;
  flightStatus:    string;
  product:         string;
  leadPassenger:   { firstName: string; lastName: string } | null;
}

export interface WalkInBookingInput {
  slotId:     string;
  passengers: PassengerInput[];
  phone?:     string;
  seatIds?:   string[];
  quoteId?:   string;
}

export interface PassengerInput {
  firstName:       string;
  lastName:        string;
  cnicOrPassport:  string;
  dateOfBirth:     string;
  nationality:     string;
  isLeadPassenger: boolean;
}

export interface CustomerProfile {
  id:          string;
  email:       string;
  name:        string;
  phone:       string | null;
  cnic:        string | null;
  nationality: string | null;
}

export interface CustomerBooking {
  pnr:             string;
  status:          string;
  totalPassengers: number;
  totalAmountUsd:  number;
  product:         string;
  departure:       string;
  arrival:         string;
  flightStatus:    string;
  createdAt:       string;
}
