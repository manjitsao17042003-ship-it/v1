
import { AppState, User, UserRole, Customer, Battery, Market, Rental, RentalStatus, BatteryColor, MarketDefinition } from '../types';

const STORAGE_KEY = 'market_charge_db_v4';

export const naturalSort = (a: string | undefined, b: string | undefined) => {
  const s1 = a || '';
  const s2 = b || '';
  return s1.localeCompare(s2, undefined, { numeric: true, sensitivity: 'base' });
};

const getInitialState = (): AppState => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) return JSON.parse(saved);

  return {
    users: [
      { id: 'admin', password: '123', role: UserRole.ADMIN, name: 'Main Admin' },
      { id: 'staff', password: '123', role: UserRole.STAFF, name: 'Test Staff' }
    ],
    marketDefinitions: [
      { id: 'm1', name: 'Main Bazar', day: 'Sunday' },
      { id: 'm2', name: 'South Market', day: 'Sunday' }
    ],
    customers: [
      { id: 'c1', name: 'Rahul Sharma', serialNumber: '1', marketName: 'Main Bazar', isDaily: false },
      { id: 'c2', name: 'Amit Patel', serialNumber: '2', marketName: 'Main Bazar', isDaily: false }
    ],
    batteries: Array.from({ length: 100 }, (_, i) => ({ 
      serial: `D${i + 1}`, 
      color: 'default'
    })),
    markets: [],
    rentals: []
  };
};

let currentState = getInitialState();

const save = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(currentState));
};

export const db = {
  getUsers: () => currentState.users,
  addUser: (user: User) => { currentState.users.push(user); save(); },
  
  // Market Definition Management
  getMarketDefinitions: () => currentState.marketDefinitions,
  addMarketDefinition: (name: string, day: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    currentState.marketDefinitions.push({ id, name, day });
    save();
  },
  deleteMarketDefinition: (id: string) => {
    currentState.marketDefinitions = currentState.marketDefinitions.filter(m => m.id !== id);
    save();
  },

  getCustomers: () => currentState.customers,
  addCustomer: (name: string, marketName: string, isDaily: boolean) => {
    // Auto-calculate serial number for this specific market
    const marketCustomers = currentState.customers.filter(c => c.marketName === marketName);
    const maxSerial = marketCustomers.reduce((max, c) => {
      const num = parseInt(c.serialNumber);
      return !isNaN(num) && num > max ? num : max;
    }, 0);
    
    const newCust: Customer = { 
      id: Math.random().toString(36).substr(2, 9), 
      name, 
      serialNumber: (maxSerial + 1).toString(), 
      marketName, 
      isDaily 
    };
    currentState.customers.push(newCust);
    save();
    return newCust;
  },

  deleteCustomer: (id: string) => {
    currentState.customers = currentState.customers.filter(c => c.id !== id);
    save();
  },

  addCustomersBulk: (customerList: any[], marketName: string, isDaily: boolean) => {
    let count = 0;
    customerList.forEach(c => {
      if (c.name) {
        db.addCustomer(String(c.name).trim(), marketName, isDaily);
        count++;
      }
    });
    return count;
  },

  getBatteries: () => currentState.batteries,
  addBatteryRange: (prefix: string, start: number, end: number, color: BatteryColor = 'default') => {
    for (let i = start; i <= end; i++) {
      const serial = `${prefix}${i}`;
      if (!currentState.batteries.find(b => b.serial === serial)) {
        currentState.batteries.push({ serial, color });
      }
    }
    save();
  },

  deleteBattery: (serial: string) => {
    currentState.batteries = currentState.batteries.filter(b => b.serial !== serial);
    save();
  },

  getMarkets: () => currentState.markets,
  addMarket: (market: Market) => {
    currentState.markets.push(market);
    save();
  },

  getRentals: () => currentState.rentals,
  addRental: (rental: Rental) => {
    currentState.rentals.push(rental);
    save();
  },

  updateRentalStatus: (rentalId: string, status: RentalStatus) => {
    const rental = currentState.rentals.find(r => r.id === rentalId);
    if (rental) {
      rental.status = status;
      save();
    }
  },

  findAvailableBatteriesForMarket: (market: Market): Battery[] => {
    const allMarketSerials: string[] = [];
    for (let i = market.batteryRangeStart; i <= market.batteryRangeEnd; i++) {
      allMarketSerials.push(`${market.batteryRangePrefix}${i}`);
    }

    const assignedSerials = currentState.rentals
      .filter(r => r.marketId === market.id && (r.status === RentalStatus.GIVEN || r.status === RentalStatus.LOST))
      .map(r => r.batterySerial);

    const availableSerials = allMarketSerials.filter(s => !assignedSerials.includes(s));
    
    return availableSerials.map(s => {
      const found = currentState.batteries.find(b => b.serial === s);
      return found || { serial: s, color: 'default' as BatteryColor };
    });
  },

  getTodayMarketForStaff: (staffId: string) => {
    const today = new Date().toISOString().split('T')[0];
    return currentState.markets.find(m => m.date === today && m.staffId === staffId);
  }
};
