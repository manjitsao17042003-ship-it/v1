
import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { db, naturalSort } from '../services/storage';
import { UserRole, RentalStatus, BatteryColor, User, Market, Rental, Customer, MarketDefinition, Battery } from '../types';

const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'summary' | 'staff' | 'customers' | 'batteries' | 'markets' | 'reports'>('summary');
  const [refresh, setRefresh] = useState(0);
  const [expandedStaffId, setExpandedStaffId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Global State for Dash
  const [markets, setMarkets] = useState<Market[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [marketDefs, setMarketDefs] = useState<MarketDefinition[]>([]);
  const [batteries, setBatteries] = useState<Battery[]>([]);

  // Form States
  const [selectedTargetMarket, setSelectedTargetMarket] = useState<string>('');
  const [newMarketName, setNewMarketName] = useState('');
  const [newMarketDay, setNewMarketDay] = useState('Sunday');
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

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [m, r, u, c, md, b] = await Promise.all([
          db.getMarkets(),
          db.getRentals(),
          db.getUsers(),
          db.getCustomers(),
          db.getMarketDefinitions(),
          db.getBatteries()
        ]);
        setMarkets(m);
        setRentals(r);
        setUsers(u);
        setCustomers(c);
        setMarketDefs(md);
        setBatteries(b);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [refresh]);

  const reportsData = useMemo(() => {
    return markets.map(m => {
      const marketRentals = rentals.filter(r => r.marketId === m.id);
      const given = marketRentals.filter(r => r.status === RentalStatus.GIVEN).length;
      const returned = marketRentals.filter(r => r.status === RentalStatus.RETURNED).length;
      const totalStock = m.batteryRangeEnd - m.batteryRangeStart + 1;
      const staff = users.find(u => u.id === m.staffId);

      return {
        ...m,
        staffName: staff?.name || 'Unknown',
        given,
        returned,
        totalStock,
        isCleared: given === 0 && returned > 0
      };
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [markets, rentals, users]);

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    await db.addUser({ id: staffId, name: staffName, password: staffPass, role: UserRole.STAFF });
    setStaffName(''); setStaffId(''); setStaffPass(''); setRefresh(r => r + 1);
  };

  const handleAddMarketDef = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMarketName.trim()) return;
    await db.addMarketDefinition(newMarketName, newMarketDay);
    setNewMarketName('');
    setRefresh(r => r + 1);
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTargetMarket) return alert("Select target market");
    await db.addCustomer(custName, selectedTargetMarket, selectedTargetMarket === 'Daily');
    setCustName(''); setRefresh(r => r + 1);
  };

  const handleDeleteCustomer = async (id: string) => {
    if (confirm("Delete this customer?")) {
      await db.deleteCustomer(id);
      setRefresh(r => r + 1);
    }
  };

  const handleCreateMarket = async (e: React.FormEvent) => {
    e.preventDefault();
    await db.addMarket({
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

  const handleExportCustomers = () => {
    if (!selectedTargetMarket) return;
    const marketCusts = customers
      .filter(c => c.marketName === selectedTargetMarket)
      .sort((a, b) => naturalSort(a.serialNumber, b.serialNumber))
      .map(c => ({
        "Serial Number": c.serialNumber,
        "Customer Name": c.name,
        "Market": c.marketName
      }));

    const ws = XLSX.utils.json_to_sheet(marketCusts);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Customers");
    XLSX.writeFile(wb, `Customers_${selectedTargetMarket}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedTargetMarket) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        if (typeof bstr !== 'string') return;
        
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        setIsLoading(true);
        for (const row of (data as any[])) {
          const name = row["Customer Name"] || row["Name"] || row["name"];
          if (name) {
            await db.addCustomer(name.toString().trim(), selectedTargetMarket, selectedTargetMarket === 'Daily');
          }
        }
        alert("Import completed successfully!");
        setRefresh(r => r + 1);
      } catch (err) {
        console.error(err);
        alert("Error importing file. Please ensure column header is 'Customer Name'.");
      } finally {
        setIsLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  const TabButton = ({ id, label }: { id: typeof activeTab, label: string }) => (
    <button 
      onClick={() => setActiveTab(id)}
      className={`px-4 py-2 font-bold rounded-xl transition-all whitespace-nowrap ${activeTab === id ? 'bg-emerald-600 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-100'}`}
    >
      {label}
    </button>
  );

  if (isLoading) return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin h-12 w-12 border-4 border-emerald-600 border-t-transparent rounded-full"></div>
    </div>
  );

  return (
    <div className="space-y-6 pb-12">
      <div className="flex gap-2 pb-2 border-b overflow-x-auto no-scrollbar">
        <TabButton id="summary" label="Dashboard" />
        <TabButton id="reports" label="Reports" />
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
                          <button onClick={() => { db.deleteMarketDefinition(m.id); setRefresh(r => r + 1); }} className="text-rose-400 hover:text-rose-600 font-black">×</button>
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

      {activeTab === 'reports' && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-emerald-600 text-white p-6 rounded-3xl shadow-lg">
              <p className="text-sm font-black uppercase opacity-80">Active Markets</p>
              <p className="text-4xl font-black">{reportsData.filter(m => m.given > 0).length}</p>
            </div>
            <div className="bg-rose-500 text-white p-6 rounded-3xl shadow-lg">
              <p className="text-sm font-black uppercase opacity-80">Total Units Out</p>
              <p className="text-4xl font-black">{reportsData.reduce((acc, m) => acc + m.given, 0)}</p>
            </div>
            <div className="bg-white border p-6 rounded-3xl shadow-sm">
              <p className="text-sm font-black uppercase text-gray-400">Total Returned (Overall)</p>
              <p className="text-4xl font-black text-emerald-600">
                {reportsData.reduce((acc, m) => acc + m.returned, 0)}
              </p>
            </div>
          </div>
          <div className="bg-white rounded-[2rem] border overflow-hidden shadow-sm">
            <div className="p-6 border-b bg-gray-50 flex justify-between items-center">
              <h3 className="font-black text-xl">Market Performance Report</h3>
              <button onClick={() => setRefresh(r => r + 1)} className="text-emerald-600 font-black text-sm uppercase">Refresh Data</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-[10px] uppercase font-black text-gray-400 border-b">
                  <tr>
                    <th className="px-6 py-4">Market / Date</th>
                    <th className="px-6 py-4">Staff</th>
                    <th className="px-6 py-4 text-center">GIVEN</th>
                    <th className="px-6 py-4 text-center">RETURNED</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {reportsData.map(report => (
                    <tr key={report.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-black text-gray-800">{report.name}</p>
                        <p className="text-[10px] text-gray-400 font-mono">{report.date}</p>
                      </td>
                      <td className="px-6 py-4 font-bold text-gray-600">{report.staffName}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`font-black text-lg ${report.given > 0 ? 'text-rose-500' : 'text-gray-300'}`}>
                          {report.given}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center font-black text-emerald-600 text-lg">{report.returned}</td>
                      <td className="px-6 py-4">
                        {report.given > 0 ? (
                          <span className="bg-rose-100 text-rose-700 px-3 py-1 rounded-full text-[10px] font-black uppercase border border-rose-200">Pending</span>
                        ) : report.returned > 0 ? (
                          <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-black uppercase border border-emerald-200">Cleared</span>
                        ) : (
                          <span className="bg-gray-100 text-gray-400 px-3 py-1 rounded-full text-[10px] font-black uppercase border border-gray-200">No Action</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                <option value="Daily">Daily Walk-ins</option>
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
                {users.filter(u => u.role === UserRole.STAFF).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
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
               <div className="flex justify-between items-center border-b pb-4">
                 <h3 className="font-black text-xl text-emerald-700">Add to {selectedTargetMarket}</h3>
                 <div className="flex gap-3">
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileImport} 
                      accept=".xlsx, .xls, .csv" 
                      className="hidden" 
                    />
                    <button 
                      onClick={handleImportClick}
                      className="bg-emerald-50 text-emerald-600 border border-emerald-200 px-4 py-2 rounded-xl font-bold text-xs hover:bg-emerald-100 transition-all flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                      Bulk Import
                    </button>
                    <button 
                      onClick={handleExportCustomers}
                      className="bg-gray-50 text-gray-600 border border-gray-200 px-4 py-2 rounded-xl font-bold text-xs hover:bg-gray-100 transition-all flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      Export List
                    </button>
                 </div>
               </div>
               <form onSubmit={handleAddCustomer} className="flex gap-4">
                 <input value={custName} onChange={e => setCustName(e.target.value)} placeholder="Full Name" className="flex-1 border p-4 rounded-2xl bg-gray-50 font-bold" required />
                 <button className="bg-emerald-600 text-white px-8 rounded-2xl font-black">Save</button>
               </form>
            </div>
          )}
          <div className="bg-white rounded-[2rem] border p-8 shadow-sm">
            <h3 className="font-black text-2xl mb-8">{selectedTargetMarket || 'All'} Customers</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {customers
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
          <form onSubmit={async (e) => { e.preventDefault(); await db.addBatteryRange(prefix, start, end, bColor); setRefresh(r => r + 1); }} className="bg-white p-8 rounded-3xl border grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
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
              {batteries.sort((a,b) => naturalSort(a.serial, b.serial)).map(b => (
                <div key={b.serial} className="px-3 py-2 bg-gray-50 rounded-xl text-xs font-mono font-black border group flex items-center gap-2">
                  {b.serial}
                  <button onClick={async () => { if(confirm("Remove?")) { await db.deleteBattery(b.serial); setRefresh(r => r + 1); } }} className="text-rose-300 hover:text-rose-600 font-bold">×</button>
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
            {users.filter(u => u.role === UserRole.STAFF).map(u => {
              const staffMarkets = reportsData.filter(m => m.staffId === u.id);
              const totalOut = staffMarkets.reduce((acc, m) => acc + m.given, 0);
              const isExpanded = expandedStaffId === u.id;
              return (
                <div key={u.id} className="bg-white rounded-3xl border shadow-sm overflow-hidden flex flex-col group">
                  <div 
                    onClick={() => setExpandedStaffId(isExpanded ? null : u.id)}
                    className="p-6 flex justify-between items-center cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <div>
                      <span className="font-black text-gray-800 text-lg block">{u.name}</span>
                      <span className="text-xs font-mono text-gray-400">ID: {u.id}</span>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="text-[10px] text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full font-black uppercase border border-emerald-100">Staff</div>
                      {totalOut > 0 && (
                        <span className="text-[10px] bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full font-black">
                          {totalOut} PENDING
                        </span>
                      )}
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="p-6 bg-gray-50 border-t space-y-4 animate-in slide-in-from-top-2">
                      <h4 className="text-xs font-black uppercase text-gray-400 tracking-widest">Assigned Markets</h4>
                      {staffMarkets.length === 0 ? (
                        <p className="text-sm font-bold text-gray-400">No markets assigned yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {staffMarkets.map(m => (
                            <div key={m.id} className="bg-white p-4 rounded-2xl border flex justify-between items-center shadow-sm">
                              <div>
                                <p className="font-black text-gray-700">{m.name}</p>
                                <p className="text-[10px] text-gray-400">{m.date}</p>
                              </div>
                              <div className="text-right">
                                <p className={`font-black ${m.given > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                  {m.given} OUT / {m.returned} RET
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
