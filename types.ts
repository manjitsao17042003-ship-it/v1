
export enum UserRole {
  ADMIN = 'ADMIN',
  STAFF = 'STAFF'
}

export interface User {
  id: string; 
  password: string;
  role: UserRole;
  name: string;
}

export interface MarketDefinition {
  id: string;
  name: string;
  day: string; // e.g. "Sunday", "Monday"
}

export interface Customer {
  id: string;
  name: string;
  serialNumber: string; // Now mandatory for auto-increment logic
  marketName: string; 
  isDaily: boolean;   
}

export type BatteryColor = 'default' | 'green' | 'pink' | 'blue' | 'red' | 'yellow' | 'black';

export interface Battery {
  serial: string;
  color?: BatteryColor;
}

export enum RentalStatus {
  GIVEN = 'GIVEN',
  RETURNED = 'RETURNED',
  LOST = 'LOST'
}

export interface Rental {
  id: string;
  marketId: string;
  customerId: string;
  batterySerial: string;
  batteryColor?: BatteryColor;
  status: RentalStatus;
  date: string; // YYYY-MM-DD
  staffId: string;
  timestamp: number;
}

export interface Market {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  staffId: string;
  assignedCustomerIds: string[];
  batteryRangePrefix: string;
  batteryRangeStart: number;
  batteryRangeEnd: number;
}

export interface AppState {
  users: User[];
  customers: Customer[];
  batteries: Battery[];
  markets: Market[];
  rentals: Rental[];
  marketDefinitions: MarketDefinition[];
}
