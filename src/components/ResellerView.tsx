import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, addDoc, doc, setDoc } from 'firebase/firestore';
import { addSpreadsheetRow, createCalendarEvent, sendGmailEmail } from '../lib/googleApi';
import { KpiTarget, WeeklyPlan, StatusReport, LeadCollection, FinanceRecord } from '../types';
import { User } from 'firebase/auth';
import { 
  TrendingUp, Calendar, ChevronRight, CheckCircle2, AlertCircle, Plus, 
  MapPin, Phone, Building, DollarSign, Send, ClipboardList, Target, Compass,
  FolderSync, ShieldCheck, CreditCard, Link, GripVertical, MoreHorizontal,
  ChevronLeft, ChevronsLeft, ChevronsRight, Info
} from 'lucide-react';
import { motion } from 'motion/react';
import { Card, CardHeader, CardTitle, CardDescription } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Input, Select } from './ui/Input';

interface ResellerViewProps {
  user: User;
  userArea?: string;
  spreadsheetId: string | null;
}

export default function ResellerView({ user, userArea = 'Mombasa', spreadsheetId }: ResellerViewProps) {
  // Lists
  const [kpis, setKpis] = useState<KpiTarget[]>([]);
  const [finances, setFinances] = useState<FinanceRecord[]>([]);
  const [leads, setLeads] = useState<LeadCollection[]>([]);
  const [reports, setReports] = useState<StatusReport[]>([]);
  
  // States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form Fields - Achievements/Leads
  const [clientName, setClientName] = useState('');
  const [locationName, setLocationName] = useState('');
  const [institution, setInstitution] = useState('Privately Owned Business');
  const [contactNumber, setContactNumber] = useState('');
  const [revenue, setRevenue] = useState('');

  // Form Fields - Planning
  const [weekStart, setWeekStart] = useState('2026-06-15');
  const [objective, setObjective] = useState('');
  const [planTasks, setPlanTasks] = useState('');
  const [syncToCalendar, setSyncToCalendar] = useState(false);

  // Form Fields - Status Reports
  const [reportWeek, setReportWeek] = useState('2026-06-15');
  const [achievementsText, setAchievementsText] = useState('');
  const [challengesText, setChallengesText] = useState('');

  // Table State
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchResellerData();
  }, [user]);

  const fetchResellerData = async () => {
    setLoading(true);
    setError(null);
    try {
      const kpisQuery = query(collection(db, 'kpis'), where('resellerId', '==', user.uid));
      const kpisSnap = await getDocs(kpisQuery);
      setKpis(kpisSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as KpiTarget[]);

      const finQuery = query(collection(db, 'finances'), where('resellerId', '==', user.uid));
      const finSnap = await getDocs(finQuery);
      setFinances(finSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as FinanceRecord[]);

      const leadQuery = query(collection(db, 'leads'), where('resellerId', '==', user.uid));
      const leadSnap = await getDocs(leadQuery);
      setLeads(leadSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as LeadCollection[]);

      const reportQuery = query(collection(db, 'reports'), where('resellerId', '==', user.uid));
      const reportSnap = await getDocs(reportQuery);
      setReports(reportSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as StatusReport[]);
    } catch (err: any) {
      console.error('Fetch dashboard error:', err);
      setError('Failed to fetch dashboard metrics.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault();
    const revVal = parseFloat(revenue);
    if (!clientName || !locationName || !contactNumber || isNaN(revVal)) {
      setError('Please fill in complete lead details.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const newLead: Omit<LeadCollection, 'id'> = {
        resellerId: user.uid,
        resellerName: user.displayName || user.email || 'Reseller',
        clientName,
        location: locationName,
        institution,
        contactNumber,
        revenueCollected: revVal,
        dateAdded: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, 'leads'), newLead);
      
      if (spreadsheetId) {
        await addSpreadsheetRow(spreadsheetId, 'Leads Log', [
          docRef.id, newLead.resellerName, newLead.clientName, newLead.location, 
          newLead.institution, newLead.contactNumber, newLead.revenueCollected, new Date(newLead.dateAdded).toLocaleString()
        ]).catch(e => console.warn('Sheet sync deferred', e));
      }

      setSuccess(`Connection Lead logged and synced!`);
      setClientName(''); setLocationName(''); setContactNumber(''); setRevenue('');
      await fetchResellerData();
    } catch (err: any) {
      console.error('Lead logging error:', err);
      setError('Lead logging failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const newPlan: WeeklyPlan = {
        id: `plan_${user.uid}_${weekStart}`, resellerId: user.uid,
        weekStartDate: weekStart, objective, tasks: planTasks
      };
      await setDoc(doc(db, 'plans', newPlan.id), newPlan);

      if (syncToCalendar) {
        const startTime = `${weekStart}T09:00:00+03:00`;
        const endTime = `${weekStart}T17:00:00+03:00`;
        await createCalendarEvent(
          `Reseller Work Week Plan: ${user.displayName || user.email}`,
          `Objective: ${objective}\nTasks:\n${planTasks}`,
          startTime, endTime
        ).catch(() => {});
      }

      setSuccess('Weekly strategy documented!');
      setObjective(''); setPlanTasks('');
    } catch (err: any) {
      console.error('Plan error:', err);
      setError('Plan configuration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const newReport: StatusReport = {
        id: `rep_${user.uid}_${reportWeek}`, resellerId: user.uid,
        weekStartDate: reportWeek, achievements: achievementsText,
        challenges: challengesText, status: 'pending_review', submittedAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'reports', newReport.id), newReport);

      await sendGmailEmail(
        'malingib9@gmail.com',
        `Status Report Submitted: ${user.displayName || user.email}`,
        `<h3>Status report filed for review</h3>
         <p>Reseller <strong>${user.displayName || user.email}</strong> (${userArea}) submitted their weekly reports.</p>`
      ).catch(() => {});

      setSuccess('Status report submitted for review!');
      setAchievementsText(''); setChallengesText('');
    } catch (err: any) {
      console.error('Report error:', err);
      setError('Report filing failed.');
    } finally {
      setLoading(false);
    }
  };

  // Metrics
  const leadsCount = leads.length;
  const totalRevenue = leads.reduce((sum, item) => sum + item.revenueCollected, 0);
  const leadTarget = kpis.find(k => k.kpiName.toLowerCase().includes('lead'))?.targetValue || 0;
  const leadProgress = leadTarget > 0 ? Math.min(100, (leadsCount / leadTarget) * 100) : 0;

  // Chart Data - Mon to Sun
  const weekDayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const displayDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dailyRev: Record<string, number> = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };
  
  leads.forEach(l => {
    const dayIndex = new Date(l.dateAdded).getDay();
    const dayName = weekDayMap[dayIndex];
    if (dayName in dailyRev) dailyRev[dayName] += l.revenueCollected;
  });
  const trendPoints = displayDays.map(d => dailyRev[d]);
  const maxTrend = Math.max(...trendPoints, 1000);

  // Pagination
  const totalPages = Math.ceil(leads.length / rowsPerPage) || 1;
  const currentLeads = leads.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  return (
    <div className="space-y-8">
      {/* Notifications */}
      {error && <div className="p-4 one-glass border-one-red/20 bg-one-red/5 text-one-red rounded-2xl text-xs font-bold flex items-center gap-3 animate-one-fade-in"><AlertCircle size={18}/>{error}</div>}
      {success && <div className="p-4 one-glass border-one-green/20 bg-one-green/5 text-one-green rounded-2xl text-xs font-bold flex items-center gap-3 animate-one-fade-in"><CheckCircle2 size={18}/>{success}</div>}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Revenue" value={`KES ${totalRevenue.toLocaleString()}`} subtitle="Collected Total" icon={<DollarSign/>} color="blue" />
        <StatCard title="Connections" value={`${leadsCount} / ${leadTarget}`} subtitle={`${Math.round(leadProgress)}% Target`} icon={<TrendingUp/>} color="indigo" progress={leadProgress} />
        <StatCard title="Status" value="Active" subtitle="System Status: Online" icon={<ShieldCheck/>} color="green" />
        <StatCard title="Reports" value={reports.length} subtitle="Filings Logged" icon={<ClipboardList/>} color="orange" />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Performance Chart */}
        <Card className="lg:col-span-8 overflow-hidden relative group">
           <CardHeader>
             <div>
               <CardTitle>Daily Pipeline Trend</CardTitle>
               <CardDescription>Revenue collection per day</CardDescription>
             </div>
             <Badge variant="blue">Week Start: {weekStart}</Badge>
           </CardHeader>
           <div className="h-48 mt-4 flex items-end justify-between px-8 pb-8">
             {trendPoints.map((val, i) => (
               <div key={i} className="w-12 bg-one-blue/10 rounded-2xl relative group/bar transition-all hover:bg-one-blue/20 h-full">
                 <motion.div 
                   initial={{ height: 0 }} 
                   animate={{ height: `${(val / maxTrend) * 100}%` }} 
                   className="absolute bottom-0 left-0 w-full bg-one-blue rounded-2xl shadow-lg shadow-one-blue/20"
                 />
                 <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-black text-one-blue opacity-0 group-hover/bar:opacity-100 transition-opacity">
                   {val}
                 </div>
                 <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                   {['M','T','W','T','F','S','S'][i]}
                 </div>
               </div>
             ))}
           </div>
        </Card>

        {/* Lead Form */}
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Log Lead</CardTitle>
            <div className="p-2 bg-one-indigo/10 text-one-indigo rounded-xl"><Plus size={20}/></div>
          </CardHeader>
          <form onSubmit={handleAddLead} className="space-y-4">
            <Input label="Client Name" value={clientName} onChange={(e) => setClientName(e.target.value)} required placeholder="Malindi Resort" />
            <Input label="Location" value={locationName} onChange={(e) => setLocationName(e.target.value)} required placeholder="Shanzu, Mombasa" />
            <div className="grid grid-cols-2 gap-4">
              <Select label="Type" value={institution} onChange={(e) => setInstitution(e.target.value)}>
                <option>Business</option><option>School</option><option>Household</option>
              </Select>
              <Input label="Revenue" type="number" value={revenue} onChange={(e) => setRevenue(e.target.value)} placeholder="7500" />
            </div>
            <Input label="Phone" value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} required placeholder="2547..." />
            <Button type="submit" variant="primary" className="w-full">Document Lead</Button>
          </form>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Strategy Planning */}
        <Card>
          <CardHeader>
            <CardTitle>Strategy Form</CardTitle>
            <div className="p-2 bg-one-blue/10 text-one-blue rounded-xl"><Target size={20}/></div>
          </CardHeader>
          <form onSubmit={handleAddPlan} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Week Date" type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} />
              <div className="flex flex-col gap-2 pt-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="rounded" checked={syncToCalendar} onChange={(e)=>setSyncToCalendar(e.target.checked)}/>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Calendar Sync</span>
                </label>
              </div>
            </div>
            <Input label="Objective" value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="Target 5 units..." />
            <textarea className="one-input min-h-[80px]" placeholder="Daily breakdown..." value={planTasks} onChange={(e)=>setPlanTasks(e.target.value)} />
            <Button type="submit" variant="secondary" className="w-full">Log Strategy</Button>
          </form>
        </Card>

        {/* Report Board */}
        <Card>
          <CardHeader>
            <CardTitle>Review Filing</CardTitle>
            <div className="p-2 bg-one-orange/10 text-one-orange rounded-xl"><Compass size={20}/></div>
          </CardHeader>
          <form onSubmit={handleSubmitReport} className="space-y-4">
            <Input label="Report Week" type="date" value={reportWeek} onChange={(e) => setReportWeek(e.target.value)} />
            <Input label="Achievements" value={achievementsText} onChange={(e) => setAchievementsText(e.target.value)} placeholder="Sales closed..." />
            <Input label="Hurdles" value={challengesText} onChange={(e) => setChallengesText(e.target.value)} placeholder="Transport issues..." />
            <Button type="submit" variant="success" className="w-full">Send Report</Button>
          </form>
        </Card>
      </div>

      {/* History Table */}
      <Card className="p-0 overflow-hidden">
        <CardHeader className="p-8 border-b border-slate-50">
          <div>
            <CardTitle>Recent Allocations</CardTitle>
            <CardDescription>Field connections ledger</CardDescription>
          </div>
          <Badge variant="blue">{leads.length} Records</Badge>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-8 py-4">Client</th>
                <th className="px-4 py-4">Location</th>
                <th className="px-4 py-4 text-center">Revenue</th>
                <th className="px-4 py-4">Sector</th>
                <th className="px-8 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {currentLeads.map(l => (
                <tr key={l.id} className="hover:bg-slate-50/30">
                  <td className="px-8 py-5">
                    <p className="text-sm font-bold text-slate-900">{l.clientName}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">{l.institution}</p>
                  </td>
                  <td className="px-4 py-5 text-xs font-bold text-slate-600">{l.location}</td>
                  <td className="px-4 py-5 text-center font-mono font-bold text-xs">KES {l.revenueCollected.toLocaleString()}</td>
                  <td className="px-4 py-5"><Badge variant="indigo">{userArea}</Badge></td>
                  <td className="px-8 py-5 text-right"><MoreHorizontal size={16} className="ml-auto text-slate-300"/></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-6 border-t border-slate-50 flex items-center justify-between">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Page {currentPage} of {totalPages}</p>
           <div className="flex gap-2">
             <Button size="sm" variant="ghost" onClick={()=>setCurrentPage(Math.max(1, currentPage-1))} disabled={currentPage===1}><ChevronLeft size={16}/></Button>
             <Button size="sm" variant="ghost" onClick={()=>setCurrentPage(Math.min(totalPages, currentPage+1))} disabled={currentPage===totalPages}><ChevronRight size={16}/></Button>
           </div>
        </div>
      </Card>
    </div>
  );
}

function StatCard({ title, value, subtitle, icon, color, progress }: any) {
  const colors = {
    blue: 'text-one-blue bg-one-blue/10',
    indigo: 'text-one-indigo bg-one-indigo/10',
    green: 'text-one-green bg-one-green/10',
    orange: 'text-one-orange bg-one-orange/10',
  };

  return (
    <Card className="flex flex-col justify-between h-44">
      <div className="flex justify-between items-start">
        <div className={`p-3 rounded-2xl ${colors[color as keyof typeof colors]}`}>
          {React.cloneElement(icon, { size: 20 })}
        </div>
        <Badge variant={color}>{title}</Badge>
      </div>
      <div>
        <h4 className="text-2xl font-black tracking-tighter text-slate-900 mt-4">{value}</h4>
        <p className="text-[11px] font-bold text-slate-400 mt-1 uppercase tracking-wider">{subtitle}</p>
        {progress !== undefined && (
          <div className="w-full bg-slate-100 h-1 rounded-full mt-3 overflow-hidden">
            <div className={`h-full bg-one-${color} rounded-full`} style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>
    </Card>
  );
}
