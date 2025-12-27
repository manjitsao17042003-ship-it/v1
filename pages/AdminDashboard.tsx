
import React, { useState, useRef, useMemo } from 'react';
import { db, naturalSort } from '../services/storage';
import { UserRole, RentalStatus, BatteryColor } from '../types';

const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'summary' | 'staff' | 'customers' | 'batteries' | 'markets' | 'demand'>('summary');
  const [refresh, setRefresh] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Global State for Customers Tab
  const [selectedTargetMarket, setSelectedTargetMarket] = useState<string>('');

  // Market Config Forms
  const [newMarketName, setNewMarketName] = useState('');
  const [newMarketDay, setNewMarketDay] = useState('Sunday');

  // Forms
  const [staffName, setStaffName] = useState('');
  const [staffId, setStaffId] = useState('');
  const [staffPass, setStaffPass] = useState('');

  const [custName, setCustName] = useState('');

  const [prefix, setPrefix] = useState('');
  const [start, setStart] = useState(1);
  const [end, setEnd] = useState(10);
  const [bColor, setBColor] = useState<BatteryColor>('default');

  const [mName, setMName] = useState('');
  const [mDate, setMDate] = useState(new Date().toISOString().split('T')[0]);
  const [mStaff, setMStaff] = useState('');
  const [mPrefix, setMPrefix] = useState('');
  const [mStart, setMStart] = useState(1);
  const [mEnd, setMEnd] = useState(10);

  const handleAddStaff = (e: React.FormEvent) => {
    e.preventDefault();
    db.addUser({ id: staffId, name: staffName, password: staffPass, role: UserRole.STAFF });
    setStaffName(''); setStaffId(''); setStaffPass(''); setRefresh(r => r + 1);
  };

  const handleAddMarketDef = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMarketName.trim()) return;
    db.addMarketDefinition(newMarketName, newMarketDay);
    setNewMarketName('');
    setRefresh(r => r + 1);
  };

  const handleAddCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTargetMarket) {
      alert("Please select a target market first.");
      return;
    }
    const isDaily = selectedTargetMarket === 'Daily';
    db.addCustomer(custName, selectedTargetMarket, isDaily);
    setCustName(''); setRefresh(r => r + 1);
  };

  const handleDeleteCustomer = (id: string) => {
    if (confirm("Delete this customer?")) {
      db.deleteCustomer(id);
      setRefresh(r => r + 1);
    }
  };

  const handleCreateMarket = (e: React.FormEvent) => {
    e.preventDefault();
    db.addMarket({
      id: Math.random().toString(36).substr(2, 9),
      name: mName,
      date: mDate,
      staffId: mStaff,
      assignedCustomerIds: [], 
      batteryRangePrefix: mPrefix,
      batteryRangeStart: mStart,
      batteryRangeEnd: mEnd
    });
    setRefresh(r => r + 1);
    alert('Market scheduled successfully.');
  };

  const marketDefs = db.getMarketDefinitions();
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  const TabButton = ({ id, label }: { id: typeof activeTab, label: string }) => (
    <button 
      onClick={() => setActiveTab(id)}
      className={`px-4 py-2 font-bold rounded-xl transition-all whitespace-nowrap ${activeTab === id ? 'bg-emerald-600 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-100'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-6 pb-12">
      <div className="flex gap-2 pb-2 border-b overflow-x-auto no-scrollbar">
        <TabButton id="summary" label="Dashboard" />
        <TabButton id="markets" label="Scheduling" />
        <TabButton id="staff" label="Staff" />
        <TabButton id="customers" label="Customers" />
        <TabButton id="batteries" label="Inventory" />
      </div>

      {activeTab === 'summary' && (
        <div className="space-y-6">
          <div className="bg-white p-8 rounded-3xl shadow-sm border space-y-6">
            <h3 className="font-black text-xl">Manage Market List (By Day)</h3>
            <form onSubmit={handleAddMarketDef} className="flex flex-wrap gap-4">
              <input value={newMarketName} onChange={e => setNewMarketName(e.target.value)} placeholder="Market Name" className="flex-1 min-w-[200px] border p-4 rounded-2xl bg-gray-50 font-bold" required />
              <select value={newMarketDay} onChange={e => setNewMarketDay(e.target.value)} className="border p-4 rounded-2xl bg-gray-50 font-bold">
                {days.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <button className="bg-emerald-600 text-white px-8 rounded-2xl font-black">Add Market</button>
            </form>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
              {days.map(day => {
                const dayMarkets = marketDefs.filter(m => m.day === day);
                if (dayMarkets.length === 0) return null;
                return (
                  <div key={day} className="p-6 bg-gray-50 rounded-2xl border">
                    <h4 className="font-black text-emerald-600 mb-4">{day}</h4>
                    <div className="space-y-2">
                      {dayMarkets.map(m => (
                        <div key={m.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-gray-100">
                          <span className="font-bold">{m.name}</span>
                          <button onClick={() => db.deleteMarketDefinition(m.id)} className="text-rose-400 hover:text-rose-600 font-black">×</button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'markets' && (
        <form onSubmit={handleCreateMarket} className="bg-white p-8 rounded-3xl shadow-sm border space-y-6">
          <h3 className="font-black text-xl">Schedule Active Market</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="text-xs font-black text-gray-400 uppercase">Market Type</label>
              <select value={mName} onChange={e => setMName(e.target.value)} className="w-full border p-4 rounded-2xl bg-gray-50 font-bold" required>
                <option value="">Choose...</option>
                <option value="Daily" className="text-blue-600">Daily Walk-ins</option>
                {marketDefs.map(n => <option key={n.id} value={n.name}>{n.day}: {n.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-black text-gray-400 uppercase">Date</label>
              <input type="date" value={mDate} onChange={e => setMDate(e.target.value)} className="w-full border p-4 rounded-2xl bg-gray-50 font-bold" required />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-black text-gray-400 uppercase">Assign Staff</label>
              <select value={mStaff} onChange={e => setMStaff(e.target.value)} className="w-full border p-4 rounded-2xl bg-gray-50 font-bold" required>
                <option value="">Choose Staff...</option>
                {db.getUsers().filter(u => u.role === UserRole.STAFF).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-black text-gray-400 uppercase">Battery Range</label>
              <div className="flex gap-2">
                <input value={mPrefix} onChange={e => setMPrefix(e.target.value.toUpperCase())} placeholder="Prefix" className="border w-24 p-4 rounded-2xl bg-gray-50 font-bold" required />
                <input type="number" value={mStart} onChange={e => setMStart(parseInt(e.target.value))} className="border flex-1 p-4 rounded-2xl bg-gray-50 font-bold text-center" required />
                <input type="number" value={mEnd} onChange={e => setMEnd(parseInt(e.target.value))} className="border flex-1 p-4 rounded-2xl bg-gray-50 font-bold text-center" required />
              </div>
            </div>
          </div>
          <button className="w-full bg-emerald-700 text-white py-6 rounded-3xl font-black text-xl shadow-xl active:scale-95 transition-all">START OPERATION</button>
        </form>
      )}

      {activeTab === 'customers' && (
        <div className="space-y-8">
          <div className="bg-emerald-600 p-8 rounded-3xl shadow-lg text-white">
            <h3 className="font-black text-xl mb-4">Select Market to Add Customer</h3>
            <select 
              value={selectedTargetMarket} 
              onChange={e => setSelectedTargetMarket(e.target.value)} 
              className="w-full p-4 rounded-2xl bg-white text-emerald-900 font-black text-lg outline-none"
            >
              <option value="">-- Choose Category --</option>
              <option value="Daily">Daily Walk-ins</option>
              {marketDefs.map(n => <option key={n.id} value={n.name}>{n.day}: {n.name}</option>)}
            </select>
          </div>

          {selectedTargetMarket && (
            <div className="bg-white p-8 rounded-3xl border space-y-6">
               <h3 className="font-black text-xl text-emerald-700">Add to {selectedTargetMarket}</h3>
               <form onSubmit={handleAddCustomer} className="flex gap-4">
                 <input value={custName} onChange={e => setCustName(e.target.value)} placeholder="Full Name" className="flex-1 border p-4 rounded-2xl bg-gray-50 font-bold" required />
                 <button className="bg-emerald-600 text-white px-8 rounded-2xl font-black">Save (Auto Serial)</button>
               </form>
            </div>
          )}

          <div className="bg-white rounded-[2rem] border p-8 shadow-sm">
            <h3 className="font-black text-2xl mb-8">{selectedTargetMarket || 'All'} Customers</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {db.getCustomers()
                .filter(c => !selectedTargetMarket || c.marketName === selectedTargetMarket)
                .sort((a,b) => naturalSort(a.serialNumber, b.serialNumber)).map(c => (
                <div key={c.id} className="p-6 bg-gray-50 rounded-2xl border flex justify-between items-start group">
                  <div>
                    <span className="font-black text-gray-900 block">{c.name}</span>
                    <span className="text-[10px] font-black uppercase text-emerald-500 mt-1">{c.marketName}</span>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-lg text-sm font-black border border-emerald-200">#{c.serialNumber}</span>
                    <button onClick={() => handleDeleteCustomer(c.id)} className="text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity p-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'batteries' && (
        <div className="space-y-6">
          <form onSubmit={(e) => { e.preventDefault(); db.addBatteryRange(prefix, start, end, bColor); setRefresh(r => r + 1); }} className="bg-white p-8 rounded-3xl border grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div>
              <label className="text-[10px] font-black uppercase text-gray-400">Prefix</label>
              <input value={prefix} onChange={e => setPrefix(e.target.value.toUpperCase())} className="w-full border p-4 rounded-2xl bg-gray-50 font-bold" required />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-gray-400">Start</label>
              <input type="number" value={start} onChange={e => setStart(parseInt(e.target.value))} className="w-full border p-4 rounded-2xl bg-gray-50 font-bold" required />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-gray-400">End</label>
              <input type="number" value={end} onChange={e => setEnd(parseInt(e.target.value))} className="w-full border p-4 rounded-2xl bg-gray-50 font-bold" required />
            </div>
            <button className="bg-emerald-600 text-white p-4 rounded-2xl font-black shadow-lg">Add Range</button>
          </form>
          <div className="bg-white p-8 rounded-3xl border">
            <h3 className="font-black text-xl mb-6">Inventory List</h3>
            <div className="flex flex-wrap gap-2">
              {db.getBatteries().sort((a,b) => naturalSort(a.serial, b.serial)).map(b => (
                <div key={b.serial} className="px-3 py-2 bg-gray-50 rounded-xl text-xs font-mono font-black border group flex items-center gap-2">
                  {b.serial}
                  <button onClick={() => { if(confirm("Remove?")) db.deleteBattery(b.serial); setRefresh(r => r + 1); }} className="text-rose-300 hover:text-rose-600 font-bold">×</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'staff' && (
        <div className="space-y-6">
          <form onSubmit={handleAddStaff} className="bg-white p-8 rounded-3xl border space-y-4 shadow-sm">
            <h3 className="font-black text-xl">Onboard Staff Member</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <input value={staffName} onChange={e => setStaffName(e.target.value)} placeholder="Name" className="border p-4 rounded-2xl bg-gray-50 font-bold" required />
              <input value={staffId} onChange={e => setStaffId(e.target.value)} placeholder="Username" className="border p-4 rounded-2xl bg-gray-50 font-bold" required />
              <input value={staffPass} onChange={e => setStaffPass(e.target.value)} placeholder="Password" type="password" className="border p-4 rounded-2xl bg-gray-50 font-bold" required />
            </div>
            <button className="w-full bg-emerald-600 text-white p-4 rounded-2xl font-black hover:bg-emerald-700 transition-colors">Create Account</button>
          </form>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
            {db.getUsers().filter(u => u.role === UserRole.STAFF).map(u => (
              <div key={u.id} className="p-6 bg-white rounded-3xl border flex justify-between items-center group shadow-sm">
                <div>
                  <span className="font-black text-gray-800 text-lg block">{u.name}</span>
                  <span className="text-xs font-mono text-gray-400">ID: {u.id}</span>
                </div>
                <div className="text-[10px] text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full font-black uppercase border border-emerald-100">Staff</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
