import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, doc, updateDoc, addDoc, query, where } from 'firebase/firestore';
import { sendGmailEmail, createGoogleTask } from '../lib/googleApi';
import { UserProfile, KpiTarget, WeeklyPlan, StatusReport, LeadCollection, CoastArea } from '../types';
import { 
  Building, UserCheck, BarChart3, Calendar, ClipboardCheck, DollarSign, 
  Map, Target, ArrowUpRight, MessageSquare, Plus, AlertCircle, CheckCircle2,
  TrendingUp, Users, MoreHorizontal, GripVertical, Search, LayoutGrid, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight
} from 'lucide-react';
import { Button } from './ui/Button';
import { Card, CardHeader, CardTitle, CardDescription } from './ui/Card';
import { Badge } from './ui/Badge';
import { Input, Select } from './ui/Input';
import { motion } from 'motion/react';

interface ManagementViewProps {
  currentUser: any;
}

export default function ManagementView({ currentUser }: ManagementViewProps) {
  // Lists
  const [resellers, setResellers] = useState<UserProfile[]>([]);
  const [reports, setReports] = useState<StatusReport[]>([]);
  const [plans, setPlans] = useState<WeeklyPlan[]>([]);
  const [leads, setLeads] = useState<LeadCollection[]>([]);
  const [kpis, setKpis] = useState<KpiTarget[]>([]);

  // UI States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Allocate KPI Form State
  const [targetReseller, setTargetReseller] = useState('');
  const [selectedKpiName, setSelectedKpiName] = useState('Active Lead Connections');
  const [targetVal, setTargetVal] = useState('');
  const [targetPeriod, setTargetPeriod] = useState('2026 June');

  // Feedback State for reviews
  const [reviewingReportId, setReviewingReportId] = useState<string | null>(null);
  const [writtenFeedback, setWrittenFeedback] = useState('');

  // Table State
  const [activeTab, setActiveTab] = useState<'all' | 'mombasa' | 'locations'>('all');
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchManagementData();
  }, []);

  const fetchManagementData = async () => {
    setLoading(true);
    try {
      const usersQuery = query(collection(db, 'users'), where('role', '==', 'reseller'));
      const usersSnap = await getDocs(usersQuery);
      const resList = usersSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() })) as UserProfile[];
      setResellers(resList);
      if (resList.length > 0) setTargetReseller(resList[0].uid);

      const reportsSnap = await getDocs(collection(db, 'reports'));
      setReports(reportsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as StatusReport[]);

      const plansSnap = await getDocs(collection(db, 'plans'));
      setPlans(plansSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as WeeklyPlan[]);

      const leadsSnap = await getDocs(collection(db, 'leads'));
      setLeads(leadsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as LeadCollection[]);

      const kpiSnap = await getDocs(collection(db, 'kpis'));
      setKpis(kpiSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as KpiTarget[]);
    } catch (err) {
      setError('Failed to extract data.');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignKpi = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const resellerUser = resellers.find(r => r.uid === targetReseller);
      await addDoc(collection(db, 'kpis'), {
        resellerId: targetReseller, resellerName: resellerUser?.displayName || 'Agent',
        kpiName: selectedKpiName, targetValue: parseFloat(targetVal), currentValue: 0, period: targetPeriod
      });

      // Restore Email/Task notification
      await createGoogleTask(
        `KPI Milestone Allocated: ${selectedKpiName}`,
        `Target: ${targetVal} for ${targetPeriod}`
      ).catch(() => {});

      await sendGmailEmail(
        resellerUser?.email || '',
        `New KPI Target Allocated: ${selectedKpiName}`,
        `<h3>Hello ${resellerUser?.displayName},</h3>
         <p>You have been assigned a new target of <strong>${targetVal}</strong> for the period <strong>${targetPeriod}</strong>.</p>`
      ).catch(() => {});

      setSuccess(`KPI Allocated!`);
      setTargetVal('');
      await fetchManagementData();
    } catch (err) {
      setError('Logging crashed.');
    } finally {
      setLoading(false);
    }
  };

  const handleReviewReport = async (reportId: string, resellerEmail?: string) => {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'reports', reportId), { status: 'reviewed', feedback: writtenFeedback });

      // Restore Email notification
      if (resellerEmail) {
        await sendGmailEmail(
          resellerEmail,
          "Weekly Status Report Reviewed",
          `<h3>Status Report Feedback</h3>
           <p>Your report has been reviewed by management.</p>
           <p><strong>Feedback:</strong> ${writtenFeedback}</p>`
        ).catch(() => {});
      }

      setSuccess('Review completed!');
      setReviewingReportId(null); setWrittenFeedback('');
      await fetchManagementData();
    } catch (err) {
      setError('Update failed.');
    } finally {
      setLoading(false);
    }
  };

  const filteredLeads = leads.filter(l => {
    if (activeTab === 'all') return true;
    if (activeTab === 'mombasa') return l.location.toLowerCase().includes('mombasa');
    return !l.location.toLowerCase().includes('mombasa');
  });

  const totalPages = Math.ceil(filteredLeads.length / rowsPerPage) || 1;
  const currentRows = filteredLeads.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const totalRev = leads.reduce((s,l)=>s+l.revenueCollected, 0);
  const pendingReviews = reports.filter(r => r.status === 'pending_review').length;

  // Restore dynamic data for chart
  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dailyLeads = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };
  leads.forEach(l => {
    const day = weekDays[new Date(l.dateAdded).getDay() - 1] || 'Mon';
    (dailyLeads as any)[day]++;
  });
  const chartData = weekDays.map(d => (dailyLeads as any)[d]);
  const maxLeads = Math.max(...chartData, 1);

  return (
    <div className="space-y-8">
      {/* Notifications */}
      {error && <div className="p-4 one-glass border-one-red/20 bg-one-red/5 text-one-red rounded-2xl text-xs font-bold flex items-center gap-3 animate-one-fade-in"><AlertCircle size={18}/>{error}</div>}
      {success && <div className="p-4 one-glass border-one-green/20 bg-one-green/5 text-one-green rounded-2xl text-xs font-bold flex items-center gap-3 animate-one-fade-in"><CheckCircle2 size={18}/>{success}</div>}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Revenue" value={`KES ${totalRev.toLocaleString()}`} subtitle="Aggregated Sales" icon={<DollarSign/>} color="blue" />
        <StatCard title="Active Agents" value={resellers.length} subtitle="Regional Affiliates" icon={<Users/>} color="purple" />
        <StatCard title="Lead Volume" value={leads.length} subtitle="System Hookups" icon={<TrendingUp/>} color="green" />
        <StatCard title="Pending Audit" value={pendingReviews} subtitle="Reviews Required" icon={<ClipboardCheck/>} color="orange" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Chart */}
        <Card className="lg:col-span-8 flex flex-col justify-between overflow-hidden relative group">
           <CardHeader>
             <div>
               <CardTitle>Acquisition Trend</CardTitle>
               <CardDescription>Performance across coast sectors</CardDescription>
             </div>
             <div className="flex gap-1 bg-slate-50 p-1 rounded-xl">
               <button className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest bg-white shadow-sm rounded-lg text-one-blue">7 Days</button>
               <button className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">30 Days</button>
             </div>
           </CardHeader>

           <div className="h-64 mt-4 flex items-end justify-between px-8 pb-8">
             {chartData.map((val, i) => (
               <div key={i} className="w-12 bg-one-blue/10 rounded-2xl relative group/bar transition-all hover:bg-one-blue/20">
                 <motion.div
                   initial={{ height: 0 }}
                   animate={{ height: `${(val / maxLeads) * 100}%` }}
                   className="absolute bottom-0 left-0 w-full bg-one-blue rounded-2xl shadow-lg shadow-one-blue/20"
                 />
                 <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-one-blue opacity-0 group-hover/bar:opacity-100 transition-opacity">
                   {val}
                 </div>
               </div>
             ))}
           </div>
        </Card>

        {/* KPI */}
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Assign Milestone</CardTitle>
            <div className="p-2 bg-one-blue/10 text-one-blue rounded-xl"><Target size={20}/></div>
          </CardHeader>
          <form onSubmit={handleAssignKpi} className="space-y-4">
            <Select label="Agent" value={targetReseller} onChange={(e) => setTargetReseller(e.target.value)}>
              {resellers.map(r => <option key={r.uid} value={r.uid}>{r.displayName}</option>)}
            </Select>
            <Select label="Metric" value={selectedKpiName} onChange={(e) => setSelectedKpiName(e.target.value)}>
              <option>Active Lead Connections</option>
              <option>Revenue Contribution</option>
            </Select>
            <Input label="Goal" type="number" value={targetVal} onChange={(e) => setTargetVal(e.target.value)} placeholder="e.g. 15" />
            <Button type="submit" className="w-full h-12">Allocate KPI</Button>
          </form>
        </Card>
      </div>

      {/* Leads Table */}
      <Card className="p-0 overflow-hidden">
        <CardHeader className="p-8 border-b border-slate-50 flex-col sm:flex-row gap-6">
          <div>
            <CardTitle>Territory Transactions</CardTitle>
            <CardDescription>Verify field ledgers in real-time</CardDescription>
          </div>
          <div className="flex bg-slate-50 p-1 rounded-xl">
             {['all', 'mombasa', 'locations'].map(tab => (
               <button key={tab} onClick={()=>setActiveTab(tab as any)} className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === tab ? 'bg-white shadow-sm text-one-blue' : 'text-slate-400'}`}>{tab}</button>
             ))}
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-8 py-4 w-10"><input type="checkbox" className="rounded"/></th>
                <th className="px-4 py-4">Header</th>
                <th className="px-4 py-4">Section</th>
                <th className="px-4 py-4 text-center">Revenue</th>
                <th className="px-4 py-4">Reviewer</th>
                <th className="px-8 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {currentRows.map(l => (
                <tr key={l.id} className="hover:bg-slate-50/30 group">
                  <td className="px-8 py-5"><input type="checkbox" className="rounded"/></td>
                  <td className="px-4 py-5">
                    <p className="text-sm font-bold text-slate-900">{l.clientName}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">{l.location}</p>
                  </td>
                  <td className="px-4 py-5"><Badge variant="blue">{l.institution}</Badge></td>
                  <td className="px-4 py-5 text-center font-mono font-bold text-xs">{Math.round(l.revenueCollected/1000)}K</td>
                  <td className="px-4 py-5 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black">{l.resellerName.charAt(0)}</div>
                    <span className="text-xs font-bold text-slate-600">{l.resellerName}</span>
                  </td>
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

      {/* Audit Board */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Oversight Audit Board</h3>
          <Badge variant="orange">{pendingReviews} Reports Queue</Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {reports.map(report => {
            const reseller = resellers.find(r => r.uid === report.resellerId);
            const plan = plans.find(p => p.resellerId === report.resellerId && p.weekStartDate === report.weekStartDate);
            return (
              <Card key={report.id} className="space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-black text-slate-900">{reseller?.displayName || 'Agent'}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Week: {report.weekStartDate}</p>
                  </div>
                  <Badge variant={report.status === 'reviewed' ? 'green' : 'orange'}>{report.status}</Badge>
                </div>
                {plan && (
                   <div className="bg-one-blue/5 p-4 rounded-2xl border border-one-blue/10">
                     <p className="text-[9px] font-black text-one-blue uppercase mb-1 tracking-widest">Strategy Matched</p>
                     <p className="text-xs font-bold text-slate-800">"{plan.objective}"</p>
                   </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-one-green/5 p-4 rounded-2xl border border-one-green/10">
                    <p className="text-[9px] font-black text-one-green uppercase mb-1 tracking-widest">Achievements</p>
                    <p className="text-[11px] font-bold text-slate-700 leading-relaxed">"{report.achievements}"</p>
                  </div>
                  <div className="bg-one-red/5 p-4 rounded-2xl border border-one-red/10">
                    <p className="text-[9px] font-black text-one-red uppercase mb-1 tracking-widest">Hurdles</p>
                    <p className="text-[11px] font-bold text-slate-700 leading-relaxed">"{report.challenges}"</p>
                  </div>
                </div>
                {report.status === 'pending_review' ? (
                  <div className="pt-4 border-t border-slate-50 space-y-3">
                    <textarea
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-800 h-20 outline-none focus:ring-2 focus:ring-one-blue/20"
                      placeholder="Supervisor feedback..."
                      value={writtenFeedback}
                      onChange={(e) => setWrittenFeedback(e.target.value)}
                    />
                    <Button size="sm" className="w-full" onClick={() => handleReviewReport(report.id, reseller?.email)}>Dispatch Mentorship</Button>
                  </div>
                ) : (
                  <div className="pt-4 border-t border-slate-50 bg-slate-50/50 p-4 rounded-2xl">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1 tracking-widest">Director Remarks</p>
                    <p className="text-xs font-bold text-slate-500 italic">"{report.feedback}"</p>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, subtitle, icon, color }: any) {
  const colors = {
    blue: 'text-one-blue bg-one-blue/10 shadow-one-blue/10',
    purple: 'text-one-purple bg-one-purple/10 shadow-one-purple/10',
    green: 'text-one-green bg-one-green/10 shadow-one-green/10',
    orange: 'text-one-orange bg-one-orange/10 shadow-one-orange/10',
  };

  return (
    <Card className="flex flex-col justify-between h-40">
      <div className="flex justify-between items-start">
        <div className={`p-3 rounded-2xl ${colors[color as keyof typeof colors]}`}>
          {React.cloneElement(icon, { size: 20 })}
        </div>
        <Badge variant={color}>{title}</Badge>
      </div>
      <div>
        <h4 className="text-2xl font-black tracking-tighter text-slate-900 mt-4">{value}</h4>
        <p className="text-[11px] font-bold text-slate-400 mt-1 uppercase tracking-wider">{subtitle}</p>
      </div>
    </Card>
  );
}
