
import React, { useState, useEffect } from 'react';
import { db, naturalSort } from '../services/storage';
import { User, Market, Customer, RentalStatus, BatteryColor, Rental } from '../types';

interface StaffDashboardProps {
  staff: User;
}

const StaffDashboard: React.FC<StaffDashboardProps> = ({ staff }) => {
  const [market, setMarket] = useState<Market | null>(null);
  const [view, setView] = useState<'home' | 'give' | 'return'>('home');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedBatterySerials, setSelectedBatterySerials] = useState<string[]>([]);
  const [expandedReturnCustomerId, setExpandedReturnCustomerId] = useState<string | null>(null);
  const [returnSearch, setReturnSearch] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const todayMarket = db.getTodayMarketForStaff(staff.id);
    if (todayMarket) {
      setMarket(todayMarket);
    }
  }, [staff.id, refresh]);

  if (!market) {
    return (
      <div className="text-center py-12 px-6">
        <div className="bg-white p-8 rounded-3xl shadow-sm inline-block max-w-sm border">
          <div className="bg-amber-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
          </div>
          <h2 className="text-xl font-bold text-gray-800">Market Not Assigned</h2>
          <p className="text-gray-500 mt-2 text-sm leading-relaxed">No assigned market for today ({new Date().toLocaleDateString()}).</p>
        </div>
      </div>
    );
  }

  const marketCustomers = db.getCustomers().filter(c => 
    c.marketName === market.name || c.marketName === 'Daily'
  ).sort((a, b) => naturalSort(a.serialNumber, b.serialNumber));

  const allRentals = db.getRentals();
  const activeRentals = allRentals.filter(r => r.marketId === market.id && r.status === RentalStatus.GIVEN);
  const availableStock = db.findAvailableBatteriesForMarket(market).sort((a,b) => naturalSort(a.serial, b.serial));

  const isCustomerGiven = (customerId: string) => activeRentals.some(r => r.customerId === customerId);

  const toggleBatterySelection = (serial: string) => {
    setSelectedBatterySerials(prev => 
      prev.includes(serial) ? prev.filter(s => s !== serial) : [...prev, serial]
    );
  };

  const handleConfirmGive = () => {
    if (!selectedCustomerId || selectedBatterySerials.length === 0) return;

    selectedBatterySerials.forEach(serial => {
      const battery = db.getBatteries().find(b => b.serial === serial) || { serial, color: 'default' as BatteryColor };
      db.addRental({
        id: Math.random().toString(36).substr(2, 9),
        marketId: market.id,
        customerId: selectedCustomerId,
        batterySerial: serial,
        batteryColor: battery.color,
        status: RentalStatus.GIVEN,
        date: new Date().toISOString().split('T')[0],
        staffId: staff.id,
        timestamp: Date.now()
      });
    });

    setSelectedCustomerId(null);
    setSelectedBatterySerials([]);
    setRefresh(r => r + 1);
    setView('home');
    alert(`Assigned ${selectedBatterySerials.length} battery(s) successfully!`);
  };

  const handleReturn = (rentalId: string, serial: string) => {
    if (confirm(`Return battery ${serial}?`)) {
      db.updateRentalStatus(rentalId, RentalStatus.RETURNED);
      setRefresh(r => r + 1);
    }
  };

  if (view === 'give') {
    return (
      <div className="space-y-6 animate-in fade-in duration-300 pb-24">
        <div className="flex items-center gap-4 sticky top-[4rem] bg-gray-50 py-2 z-10">
          <button onClick={() => { setView('home'); setSelectedCustomerId(null); setSelectedBatterySerials([]); }} className="p-4 bg-white border rounded-2xl active:bg-gray-100 shadow-sm">
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h2 className="text-2xl font-black text-gray-800 uppercase">Give Battery</h2>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">1. Select Customer</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[40vh] overflow-y-auto no-scrollbar border p-2 rounded-2xl bg-white shadow-inner">
            {marketCustomers.map(cust => {
              const alreadyHas = isCustomerGiven(cust.id);
              const isSelected = selectedCustomerId === cust.id;
              return (
                <button 
                  key={cust.id} 
                  onClick={() => setSelectedCustomerId(cust.id)}
                  className={`relative p-4 rounded-xl font-black text-left flex flex-col transition-all border-b-4 
                    ${alreadyHas ? 'bg-rose-500 text-white border-rose-700' : 
                      isSelected ? 'bg-emerald-600 text-white border-emerald-800 scale-[0.98]' : 'bg-emerald-100 text-emerald-800 border-emerald-200 active:scale-95'}`}
                >
                  <span className="text-xs opacity-60">#{cust.serialNumber}</span>
                  <span className="truncate text-sm">{cust.name}</span>
                  {alreadyHas && <span className="absolute top-1 right-2 text-[8px] font-black uppercase">Out</span>}
                </button>
              );
            })}
          </div>
        </div>

        <div className={`space-y-3 transition-opacity duration-300 ${!selectedCustomerId ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">2. Select Battery (Multiple OK)</p>
          <div className="flex flex-wrap gap-2 max-h-[35vh] overflow-y-auto no-scrollbar border p-2 rounded-2xl bg-white shadow-inner">
            {availableStock.map(b => (
              <button 
                key={b.serial}
                onClick={() => toggleBatterySelection(b.serial)}
                className={`px-4 py-3 rounded-xl font-mono font-black text-sm border-b-4 transition-all
                  ${selectedBatterySerials.includes(b.serial) ? 'bg-gray-800 text-white border-black scale-95 shadow-inner' : 'bg-gray-100 text-gray-800 border-gray-300 active:scale-90'}`}
              >
                {b.serial}
              </button>
            ))}
          </div>
        </div>

        {selectedCustomerId && selectedBatterySerials.length > 0 && (
          <div className="fixed bottom-6 left-6 right-6 z-50 animate-in slide-in-from-bottom-6">
            <button 
              onClick={handleConfirmGive}
              className="w-full bg-emerald-600 text-white py-6 rounded-3xl text-xl font-black shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3 border-b-8 border-emerald-800"
            >
              <span>CONFIRM GIVE ({selectedBatterySerials.length})</span>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
            </button>
          </div>
        )}
      </div>
    );
  }

  if (view === 'return') {
    // Group active rentals by customer ID
    const rentalsByCustomer = activeRentals.reduce((acc, rental) => {
      if (!acc[rental.customerId]) acc[rental.customerId] = [];
      acc[rental.customerId].push(rental);
      return acc;
    }, {} as Record<string, Rental[]>);

    const customersWithRentals = marketCustomers.filter(c => rentalsByCustomer[c.id]);

    const filteredCustomers = customersWithRentals.filter(c => {
      const search = returnSearch.toLowerCase();
      const hasMatchingBattery = rentalsByCustomer[c.id].some(r => r.batterySerial.toLowerCase().includes(search));
      return c.name.toLowerCase().includes(search) || c.serialNumber.toLowerCase().includes(search) || hasMatchingBattery;
    });

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="flex items-center gap-4">
          <button onClick={() => { setView('home'); setReturnSearch(''); setExpandedReturnCustomerId(null); }} className="p-4 bg-white border rounded-2xl active:bg-gray-100 shadow-sm">
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h2 className="text-2xl font-black text-gray-800 uppercase">Return Stock</h2>
        </div>

        <div className="sticky top-[4.5rem] bg-gray-50 pb-2 z-10">
          <div className="relative">
            <input 
              type="text" 
              placeholder="Search Name or Battery No..." 
              value={returnSearch}
              onChange={(e) => { setReturnSearch(e.target.value); setExpandedReturnCustomerId(null); }}
              className="w-full p-4 pl-12 border rounded-2xl bg-white font-bold outline-none ring-2 ring-emerald-100 focus:ring-emerald-500 transition-all shadow-sm"
            />
            <svg className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">Tap Customer to view batteries</p>
          {filteredCustomers.length === 0 ? (
            <div className="bg-white p-12 rounded-3xl text-center border-2 border-dashed text-gray-400 font-black uppercase">
              {returnSearch ? 'No matching customer' : 'All batteries returned'}
            </div>
          ) : (
            filteredCustomers.map(cust => (
              <div key={cust.id} className="bg-white rounded-3xl border shadow-sm overflow-hidden transition-all">
                <button 
                  onClick={() => setExpandedReturnCustomerId(expandedReturnCustomerId === cust.id ? null : cust.id)}
                  className={`w-full p-6 flex items-center justify-between text-left active:bg-gray-50 transition-colors ${expandedReturnCustomerId === cust.id ? 'bg-emerald-50' : ''}`}
                >
                  <div className="flex flex-col">
                    <span className="font-black text-lg text-gray-800">#{cust.serialNumber} {cust.name}</span>
                    <span className="text-xs font-black text-emerald-600 uppercase tracking-widest">{rentalsByCustomer[cust.id].length} battery out</span>
                  </div>
                  <svg className={`w-6 h-6 text-gray-400 transition-transform ${expandedReturnCustomerId === cust.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                </button>
                
                {expandedReturnCustomerId === cust.id && (
                  <div className="p-4 bg-gray-50 border-t flex flex-wrap gap-2 animate-in slide-in-from-top-2 duration-200">
                    {rentalsByCustomer[cust.id].map(r => (
                      <button 
                        key={r.id}
                        onClick={() => handleReturn(r.id, r.batterySerial)}
                        className="bg-white border-2 border-emerald-500 text-emerald-700 px-4 py-3 rounded-xl font-mono font-black text-sm active:bg-emerald-600 active:text-white transition-all shadow-sm"
                      >
                        {r.batterySerial}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-300">
      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm relative overflow-hidden border-b-8 border-emerald-50">
        <h2 className="text-5xl font-black text-gray-900 leading-tight">{market.name}</h2>
        <div className="flex flex-wrap gap-3 mt-4">
          <span className="text-[10px] bg-emerald-100 px-3 py-1.5 rounded-full font-black text-emerald-700 uppercase tracking-widest">{market.date}</span>
          <span className="text-[10px] bg-gray-100 px-3 py-1.5 rounded-full font-black text-gray-500 uppercase tracking-widest">STOCK: {availableStock.length}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <button 
          onClick={() => setView('give')}
          className="group relative h-48 bg-emerald-600 text-white rounded-[2.5rem] flex flex-col items-center justify-center gap-2 active:scale-[0.97] transition-all shadow-2xl border-b-8 border-emerald-800"
        >
          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
          <span className="text-3xl font-black uppercase tracking-tighter">GIVE STOCK</span>
        </button>

        <button 
          onClick={() => setView('return')}
          className="group relative h-48 bg-white text-emerald-600 rounded-[2.5rem] flex flex-col items-center justify-center gap-2 active:scale-[0.97] transition-all border-4 border-emerald-600 shadow-xl border-b-8"
        >
          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
          <span className="text-3xl font-black uppercase tracking-tighter">COLLECT RETURN</span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-[2rem] shadow-sm text-center border">
          <p className="text-3xl font-black text-rose-500 tabular-nums">{activeRentals.length}</p>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Out Now</p>
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-sm text-center border">
          <p className="text-3xl font-black text-emerald-600 tabular-nums">{allRentals.filter(r => r.marketId === market.id && r.status === RentalStatus.RETURNED).length}</p>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Returned</p>
        </div>
      </div>
    </div>
  );
};

export default StaffDashboard;
