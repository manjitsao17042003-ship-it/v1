
import { createClient } from '@supabase/supabase-js';
import { AppState, User, UserRole, Customer, Battery, Market, Rental, RentalStatus, BatteryColor, MarketDefinition } from '../types';

const supabaseUrl = 'https://fdpcgtnlsuynekndmcpz.supabase.co';
const supabaseKey = 'sb_publishable_4JqNL6kbS0tssUkmkGA-7w_Tv12wqxr';
export const supabase = createClient(supabaseUrl, supabaseKey);

export const naturalSort = (a: string | undefined, b: string | undefined) => {
  const s1 = a || '';
  const s2 = b || '';
  return s1.localeCompare(s2, undefined, { numeric: true, sensitivity: 'base' });
};

export const db = {
  getUsers: async (): Promise<User[]> => {
    const { data, error } = await supabase.from('users').select('*');
    if (error) throw error;
    return data || [];
  },
  addUser: async (user: User) => {
    const { error } = await supabase.from('users').insert([user]);
    if (error) throw error;
  },
  
  getMarketDefinitions: async (): Promise<MarketDefinition[]> => {
    const { data, error } = await supabase.from('market_definitions').select('*');
    if (error) throw error;
    return data || [];
  },
  addMarketDefinition: async (name: string, day: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    const { error } = await supabase.from('market_definitions').insert([{ id, name, day }]);
    if (error) throw error;
  },
  deleteMarketDefinition: async (id: string) => {
    const { error } = await supabase.from('market_definitions').delete().eq('id', id);
    if (error) throw error;
  },

  getCustomers: async (): Promise<Customer[]> => {
    const { data, error } = await supabase.from('customers').select('*');
    if (error) throw error;
    return (data || []).map(c => ({
      id: c.id,
      name: c.name,
      serialNumber: c.serial_number,
      marketName: c.market_name,
      isDaily: c.is_daily
    }));
  },
  addCustomer: async (name: string, marketName: string, isDaily: boolean) => {
    const { data: existing } = await supabase
      .from('customers')
      .select('serial_number')
      .eq('market_name', marketName);
    
    const maxSerial = (existing || []).reduce((max, c) => {
      const num = parseInt(c.serial_number);
      return !isNaN(num) && num > max ? num : max;
    }, 0);
    
    const newCust = { 
      id: Math.random().toString(36).substr(2, 9), 
      name, 
      serial_number: (maxSerial + 1).toString(), 
      market_name: marketName, 
      is_daily: isDaily 
    };
    
    const { error } = await supabase.from('customers').insert([newCust]);
    if (error) throw error;
    return newCust;
  },
  deleteCustomer: async (id: string) => {
    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (error) throw error;
  },

  getBatteries: async (): Promise<Battery[]> => {
    const { data, error } = await supabase.from('batteries').select('*');
    if (error) throw error;
    return data || [];
  },
  addBatteryRange: async (prefix: string, start: number, end: number, color: BatteryColor = 'default') => {
    const batteries = [];
    for (let i = start; i <= end; i++) {
      batteries.push({ serial: `${prefix}${i}`, color });
    }
    const { error } = await supabase.from('batteries').upsert(batteries);
    if (error) throw error;
  },
  deleteBattery: async (serial: string) => {
    const { error } = await supabase.from('batteries').delete().eq('serial', serial);
    if (error) throw error;
  },

  getMarkets: async (): Promise<Market[]> => {
    const { data, error } = await supabase.from('markets').select('*');
    if (error) throw error;
    return (data || []).map(m => ({
      id: m.id,
      name: m.name,
      date: m.date,
      staffId: m.staff_id,
      assignedCustomerIds: m.assigned_customer_ids || [],
      batteryRangePrefix: m.battery_range_prefix,
      batteryRangeStart: m.battery_range_start,
      batteryRangeEnd: m.battery_range_end
    }));
  },
  addMarket: async (market: Market) => {
    const { error } = await supabase.from('markets').insert([{
      id: market.id,
      name: market.name,
      date: market.date,
      staff_id: market.staffId,
      assigned_customer_ids: market.assignedCustomerIds,
      battery_range_prefix: market.batteryRangePrefix,
      battery_range_start: market.batteryRangeStart,
      battery_range_end: market.batteryRangeEnd
    }]);
    if (error) throw error;
  },

  getRentals: async (): Promise<Rental[]> => {
    const { data, error } = await supabase.from('rentals').select('*');
    if (error) throw error;
    return (data || []).map(r => ({
      id: r.id,
      marketId: r.market_id,
      customerId: r.customer_id,
      batterySerial: r.battery_serial,
      batteryColor: r.battery_color,
      status: r.status,
      date: r.date,
      staffId: r.staff_id,
      timestamp: r.timestamp
    }));
  },
  addRental: async (rental: Rental) => {
    const { error } = await supabase.from('rentals').insert([{
      id: rental.id,
      market_id: rental.marketId,
      customer_id: rental.customerId,
      battery_serial: rental.batterySerial,
      battery_color: rental.batteryColor,
      status: rental.status,
      date: rental.date,
      staff_id: rental.staffId,
      timestamp: rental.timestamp
    }]);
    if (error) throw error;
  },
  updateRentalStatus: async (rentalId: string, status: RentalStatus) => {
    const { error } = await supabase.from('rentals').update({ status }).eq('id', rentalId);
    if (error) throw error;
  },

  findAvailableBatteriesForMarket: async (market: Market): Promise<Battery[]> => {
    const allMarketSerials: string[] = [];
    for (let i = market.batteryRangeStart; i <= market.batteryRangeEnd; i++) {
      allMarketSerials.push(`${market.batteryRangePrefix}${i}`);
    }

    const { data: rentals } = await supabase
      .from('rentals')
      .select('battery_serial')
      .eq('market_id', market.id)
      .in('status', [RentalStatus.GIVEN, RentalStatus.LOST]);

    const assignedSerials = (rentals || []).map(r => r.battery_serial);
    const availableSerials = allMarketSerials.filter(s => !assignedSerials.includes(s));
    
    const { data: batteries } = await supabase.from('batteries').select('*').in('serial', availableSerials);
    
    return availableSerials.map(s => {
      const found = (batteries || []).find(b => b.serial === s);
      return found || { serial: s, color: 'default' as BatteryColor };
    });
  },

  getTodayMarketForStaff: async (staffId: string): Promise<Market | undefined> => {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('markets')
      .select('*')
      .eq('date', today)
      .eq('staff_id', staffId)
      .maybeSingle();
    
    if (error) throw error;
    if (!data) return undefined;

    return {
      id: data.id,
      name: data.name,
      date: data.date,
      staffId: data.staff_id,
      assignedCustomerIds: data.assigned_customer_ids || [],
      batteryRangePrefix: data.battery_range_prefix,
      batteryRangeStart: data.battery_range_start,
      batteryRangeEnd: data.battery_range_end
    };
  }
};
