import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, addDoc, doc, updateDoc, query, where } from 'firebase/firestore';
import { sendGmailEmail } from '../lib/googleApi';
import { UserProfile, KpiTarget, WeeklyPlan, StatusReport, LeadCollection, CoastArea } from '../types';
import { 
  Building, UserCheck, BarChart3, Calendar, ClipboardCheck, DollarSign, 
  Map, Target, ArrowUpRight, MessageSquare, Plus, AlertCircle, CheckCircle2,
  TrendingUp, Star, Users, Flame, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, MoreHorizontal, GripVertical
} from 'lucide-react';
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
  const [chartPeriod, setChartPeriod] = useState<'3months' | '30days' | '7days'>('3months');

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
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchManagementData();
  }, []);

  const fetchManagementData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch user accounts registered with 'reseller' roles
      const usersQuery = query(collection(db, 'users'), where('role', '==', 'reseller'));
      const usersSnap = await getDocs(usersQuery);
      const resList = usersSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() })) as UserProfile[];
      setResellers(resList);
      if (resList.length > 0) setTargetReseller(resList[0].uid);

      // 2. Fetch status reports
      const reportsSnap = await getDocs(collection(db, 'reports'));
      setReports(reportsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as StatusReport[]);

      // 3. Fetch weekly plans
      const plansSnap = await getDocs(collection(db, 'plans'));
      setPlans(plansSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as WeeklyPlan[]);

      // 4. Fetch all Leads (internet collection achievements)
      const leadsSnap = await getDocs(collection(db, 'leads'));
      const allLeads = leadsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as LeadCollection[];
      setLeads(allLeads);

      // 5. Fetch all KPIs targets
      const kpiSnap = await getDocs(collection(db, 'kpis'));
      setKpis(kpiSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as KpiTarget[]);

    } catch (err: any) {
      console.error(err);
      setError('Failed to extract management directory, please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Assign KPI Target
  const handleAssignKpi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetReseller || !targetVal) {
      setError('Please select reseller and target metrics.');
      return;
    }

    const value = parseFloat(targetVal);
    if (isNaN(value) || value <= 0) {
      setError('Please supply a positive KPI target value.');
      return;
    }

    setLoading(true);
    setSuccess(null);
    setError(null);
    try {
      const resellerUser = resellers.find(r => r.uid === targetReseller);
      const newKpi: Omit<KpiTarget, 'id'> = {
        resellerId: targetReseller,
        resellerName: resellerUser?.displayName || resellerUser?.email || 'Field Agent',
        kpiName: selectedKpiName,
        targetValue: value,
        currentValue: 0,
        period: targetPeriod
      };

      await addDoc(collection(db, 'kpis'), newKpi);
      
      // Notify the reseller
      if (resellerUser?.email) {
        await sendGmailEmail(
          resellerUser.email,
          `New KPI Target Assigned: ${selectedKpiName}`,
          `<h3>Hello ${resellerUser.displayName},</h3>
           <p>Management has assigned you a new KPI Objective for ${targetPeriod}:</p>
           <ul>
             <li><strong>KPI Metric Name:</strong> ${selectedKpiName}</li>
             <li><strong>Monthly Target Value:</strong> ${value.toLocaleString()}</li>
           </ul>
           <p>Good luck with your lead procurement strategy!</p>`
        ).catch(() => console.log('Email delivery deferred'));
      }

      setSuccess(`KPI Target allocated successfully for ${resellerUser?.displayName}!`);
      setTargetVal('');
      await fetchManagementData();
    } catch (err) {
      console.error(err);
      setError('KPI configuration logging crashed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  // Submit Feedback / Review Status report
  const handleReviewReport = async (reportId: string, resellerEmail?: string) => {
    if (!writtenFeedback) {
      alert('Provide written recommendation comments before approving review.');
      return;
    }

    setLoading(true);
    setSuccess(null);
    setError(null);
    try {
      const reportRef = doc(db, 'reports', reportId);
      await updateDoc(reportRef, {
        status: 'reviewed',
        feedback: writtenFeedback
      });

      // Send Gmail alerting reseller
      if (resellerEmail) {
        await sendGmailEmail(
          resellerEmail,
          "Your Weekly Status Report has been Reviewed",
          `<h3>Status Report Evaluated</h3>
           <p>Your regional supervisor has completed review evaluations of your weekly activities:</p>
           <p><strong>Evaluation Comments:</strong> <span style="font-style:italic;">"${writtenFeedback}"</span></p>
           <p>Check your live agent board to schedule next week's objectives.</p>`
        ).catch(() => console.log('Mail delivery deferred'));
      }

      setSuccess('Status report completed review successfully!');
      setReviewingReportId(null);
      setWrittenFeedback('');
      await fetchManagementData();
    } catch (err) {
      console.error(err);
      setError('Could not modify report review state.');
    } finally {
      setLoading(false);
    }
  };

  // Dynamic Coastal Revenue aggregation per Area within "Coast" Region:
  const coastAreas: CoastArea[] = ['Mombasa', 'Malindi', 'Kilifi', 'Kwale', 'Lamu', 'Tana River'];
  
  // Create area mapping
  const areaDataMap: { [key in CoastArea]: { revenue: number, leadsCount: number } } = {
    'Mombasa': { revenue: 0, leadsCount: 0 },
    'Malindi': { revenue: 0, leadsCount: 0 },
    'Kilifi': { revenue: 0, leadsCount: 0 },
    'Kwale': { revenue: 0, leadsCount: 0 },
    'Lamu': { revenue: 0, leadsCount: 0 },
    'Tana River': { revenue: 0, leadsCount: 0 },
  };

  leads.forEach(lead => {
    let assigned = false;
    for (const area of coastAreas) {
      if (lead.location.toLowerCase().includes(area.toLowerCase())) {
        areaDataMap[area].revenue += lead.revenueCollected;
        areaDataMap[area].leadsCount += 1;
        assigned = true;
        break;
      }
    }
    if (!assigned) {
      const parentUser = resellers.find(r => r.uid === lead.resellerId);
      if (parentUser?.area && areaDataMap[parentUser.area]) {
        areaDataMap[parentUser.area].revenue += lead.revenueCollected;
        areaDataMap[parentUser.area].leadsCount += 1;
      } else {
        areaDataMap['Mombasa'].revenue += lead.revenueCollected;
        areaDataMap['Mombasa'].leadsCount += 1;
      }
    }
  });

  const areaChartData = coastAreas.map(area => ({
    name: area,
    revenue: areaDataMap[area].revenue,
    leads: areaDataMap[area].leadsCount
  }));

  const maxRevenue = Math.max(...areaChartData.map(d => d.revenue), 10000);

  // Bezier Curve generator for Area Chart
  const svgWidth = 600;
  const svgHeight = 180;
  
  // Points for SVG path
  const chartPoints = areaChartData.map((d, i) => {
    const x = (i / (areaChartData.length - 1)) * svgWidth;
    const yScaled = svgHeight - 20 - ((d.revenue / maxRevenue) * (svgHeight - 40));
    return { x, y: yScaled };
  });

  const getBezierPath = (points: { x: number; y: number }[]) => {
    if (points.length === 0) return '';
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const curr = points[i];
      const next = points[i + 1];
      const cp1x = curr.x + (next.x - curr.x) / 3;
      const cp1y = curr.y;
      const cp2x = curr.x + 2 * (next.x - curr.x) / 3;
      const cp2y = next.y;
      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.x} ${next.y}`;
    }
    return path;
  };

  const bezierCurvePath = getBezierPath(chartPoints);
  const fillPath = chartPoints.length > 0 
    ? `${bezierCurvePath} L ${svgWidth} ${svgHeight} L 0 ${svgHeight} Z`
    : '';

  // Filtered Leads for the table
  const filteredLeads = leads.filter(l => {
    if (activeTab === 'all') return true;
    if (activeTab === 'mombasa') return l.location.toLowerCase().includes('mombasa');
    return !l.location.toLowerCase().includes('mombasa'); // Other locations
  });

  // Pagination calculations
  const totalLeadsCount = filteredLeads.length;
  const totalPages = Math.ceil(totalLeadsCount / rowsPerPage) || 1;
  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  const currentLeadsRows = filteredLeads.slice(indexOfFirstRow, indexOfLastRow);

  const toggleSelectAll = () => {
    if (selectedRows.length === currentLeadsRows.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(currentLeadsRows.map(row => row.id || ''));
    }
  };

  const toggleSelectRow = (id: string) => {
    if (selectedRows.includes(id)) {
      setSelectedRows(selectedRows.filter(r => r !== id));
    } else {
      setSelectedRows([...selectedRows, id]);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner Feedbacks */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs flex items-center gap-3 animate-fadeIn">
          <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0" />
          <span className="font-semibold">{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-250 text-emerald-800 rounded-2xl text-xs flex items-center gap-3 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span className="font-bold">{success}</span>
        </div>
      )}

      {/* FOUR SHADCN-STYLE STATS CARDS */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* CARD 1: Total Revenue */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-between min-h-[140px]">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-medium text-slate-500 tracking-tight">Total Revenue Managed</span>
            <span className="text-[9px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200/50 font-bold flex items-center gap-0.5">
              +12.5%
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold tracking-tight text-slate-900 font-mono">
              KES {leads.reduce((s,l)=>s+l.revenueCollected, 0).toLocaleString()}
            </h3>
            <p className="text-[10px] text-slate-450 mt-1 font-medium">Trending up this month</p>
          </div>
        </div>

        {/* CARD 2: Active Resellers */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-between min-h-[140px]">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-medium text-slate-500 tracking-tight">Acquisition Specialities</span>
            <span className="text-[9px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200/50 font-bold">
              Active
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold tracking-tight text-slate-900">
              {resellers.length} Field Agents
            </h3>
            <p className="text-[10px] text-slate-450 mt-1 font-medium">Acquisition exceeds targets</p>
          </div>
        </div>

        {/* CARD 3: Leads Logged */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-between min-h-[140px]">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-medium text-slate-500 tracking-tight">Leads Registered</span>
            <span className="text-[9px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200/50 font-bold">
              +45.2%
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold tracking-tight text-slate-900 font-mono">
              {leads.length} Hookups
            </h3>
            <p className="text-[10px] text-slate-450 mt-1 font-medium">Verified in cloud nodes</p>
          </div>
        </div>

        {/* CARD 4: Reports Queue */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-between min-h-[140px]">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-medium text-slate-500 tracking-tight">Audit Reviews Queue</span>
            <span className={`${
              reports.filter(r => r.status === 'pending_review').length > 0 
                ? 'bg-rose-50 text-rose-700 border-rose-200' 
                : 'bg-slate-100 text-slate-600'
            } text-[9px] px-2 py-0.5 rounded-full border font-bold`}>
              {reports.filter(r => r.status === 'pending_review').length} Pending
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold tracking-tight text-slate-900">
              {reports.filter(r => r.status === 'pending_review').length} Reviews
            </h3>
            <p className="text-[10px] text-slate-450 mt-1 font-medium">Mentorship feedback active</p>
          </div>
        </div>

      </section>

      {/* DUAL MODULE AREA: Beautiful Curved Area Chart on Left, KPI Target Assign on Right */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* GORGEOUS BEZIER CURVE AREA CHART */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">Lead Acquisitions</h3>
                <p className="text-xs text-slate-400 mt-1 font-medium">Regional lead revenue and setup fee contributions</p>
              </div>

              {/* Chart Filter Buttons - exactly styled like the screenshot */}
              <div className="bg-slate-100 p-0.5 rounded-lg flex items-center shrink-0 border border-slate-200">
                <button 
                  onClick={() => setChartPeriod('3months')}
                  className={`px-3 py-1 text-[11px] font-semibold rounded-md transition-all ${
                    chartPeriod === '3months' 
                      ? 'bg-white text-slate-900 shadow-xs' 
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Last 3 months
                </button>
                <button 
                  onClick={() => setChartPeriod('30days')}
                  className={`px-3 py-1 text-[11px] font-semibold rounded-md transition-all ${
                    chartPeriod === '30days' 
                      ? 'bg-white text-slate-900 shadow-xs' 
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Last 30 days
                </button>
                <button 
                  onClick={() => setChartPeriod('7days')}
                  className={`px-3 py-1 text-[11px] font-semibold rounded-md transition-all ${
                    chartPeriod === '7days' 
                      ? 'bg-white text-slate-900 shadow-xs' 
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Last 7 days
                </button>
              </div>

            </div>

            {/* Smooth SVG Area line representation */}
            <div className="h-[200px] w-full pt-6 relative">
              <svg className="w-full h-full overflow-visible" viewBox={`0 0 ${svgWidth} ${svgHeight}`} preserveAspectRatio="none">
                <defs>
                  {/* Beautiful light blue/teal linear gradient */}
                  <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Horizontal grid guide lines */}
                <line x1="0" y1="20" x2={svgWidth} y2="20" stroke="#f1f5f9" strokeDasharray="3 3" />
                <line x1="0" y1={svgHeight/2} x2={svgWidth} y2={svgHeight/2} stroke="#f1f5f9" strokeDasharray="3 3" />
                <line x1="0" y1={svgHeight - 20} x2={svgWidth} y2={svgHeight - 20} stroke="#f1f5f9" strokeWidth="1" />

                {/* Area filled polygon path */}
                {fillPath && <path d={fillPath} fill="url(#chartGradient)" />}

                {/* Line contour path */}
                {bezierCurvePath && <path d={bezierCurvePath} fill="none" stroke="#0ea5e9" strokeWidth="2.5" strokeLinecap="round" />}

                {/* Circles for data items */}
                {chartPoints.map((p, i) => (
                  <g key={i} className="group/dot cursor-pointer">
                    <circle cx={p.x} cy={p.y} r="4" fill="#ffffff" stroke="#0ea5e9" strokeWidth="2" />
                    <circle cx={p.x} cy={p.y} r="8" fill="#0ea5e9" fillOpacity="0" className="hover:fill-opacity-10 transition-all" />
                  </g>
                ))}
              </svg>

              {/* Data points overlay representing regional sub areas */}
              <div className="absolute bottom-0 left-0 right-0 flex justify-between px-1 text-[9px] font-mono font-bold text-slate-400">
                {areaChartData.map((d, i) => (
                  <span key={i} className="text-center w-12 truncate">{d.name}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 pt-4 border-t border-slate-100">
            <div className="p-3.5 bg-slate-50/70 border border-slate-200/80 rounded-lg flex justify-between items-center text-xs">
              <span className="text-slate-400 font-bold text-[9px] uppercase tracking-wide">Top Zone Division</span>
              <span className="font-bold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-md border border-teal-200/50 text-[10px]">
                {areaChartData.length > 0 ? areaChartData.reduce((prev, current) => (prev.revenue > current.revenue) ? prev : current).name : 'Mombasa'}
              </span>
            </div>
            <div className="p-3.5 bg-slate-50/70 border border-slate-200/80 rounded-lg flex justify-between items-center text-xs">
              <span className="text-slate-400 font-bold text-[9px] uppercase tracking-wide">Overall Average Zone</span>
              <span className="font-bold text-slate-800 font-mono text-[10px]">
                KES {Math.round(leads.reduce((s,l)=>s+l.revenueCollected, 0) / (coastAreas.length || 1)).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* ASSIGN PERFORMANCE KPI FORMS */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
              <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg">
                <Target className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-xs">Assign KPI target</h3>
                <p className="text-[10px] text-slate-405 mt-0.5 font-medium">Deploy targets to agent sub-nodes</p>
              </div>
            </div>

            {resellers.length === 0 ? (
              <p className="text-xs text-slate-400 py-12 text-center font-bold">No registered affiliates available. Setup field members in Admin View.</p>
            ) : (
              <form onSubmit={handleAssignKpi} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Select Reseller Affiliate</label>
                  <select
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none bg-white font-medium text-slate-700"
                    value={targetReseller}
                    onChange={(e) => setTargetReseller(e.target.value)}
                  >
                    {resellers.map(r => (
                      <option key={r.uid} value={r.uid}>{r.displayName} ({r.area || 'No Area Assigned'})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">KPI Performance Metric</label>
                  <select
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none bg-white font-medium text-slate-700"
                    value={selectedKpiName}
                    onChange={(e) => setSelectedKpiName(e.target.value)}
                  >
                    <option value="Active Lead Connections">Active Lead Connections (Count)</option>
                    <option value="Revenue Contribution">Revenue Contribution (KES)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Monthly Goal Target</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 15 leads or 50000 KES"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none font-semibold text-slate-800"
                    value={targetVal}
                    onChange={(e) => setTargetVal(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Audit Performance Period</label>
                  <select
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none bg-white font-semibold text-slate-700"
                    value={targetPeriod}
                    onChange={(e) => setTargetPeriod(e.target.value)}
                  >
                    <option value="2026 June">June 2026</option>
                    <option value="2026 July">July 2026</option>
                    <option value="2026 August">August 2026</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 px-4 rounded-lg transition-all active:scale-95 text-xs flex items-center justify-center gap-1.5 cursor-pointer mt-2"
                >
                  <Plus className="w-3.5 h-3.5" /> Allocate Milestone
                </button>
              </form>
            )}
          </div>
        </div>

      </section>

      {/* PIXEL-PERFECT DOCUMENT TABLE - matches the screenshot perfectly */}
      <section className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        
        {/* Table outline header and tabs */}
        <div className="px-6 py-5 border-b border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">Territory Lead Transactions Registry</h3>
              <p className="text-xs text-slate-400 mt-1 font-medium">Verify field operations ledgers in real-time synced records</p>
            </div>

            {/* Table Navigation Tabs */}
            <div className="border-b border-slate-200 flex items-center text-xs shrink-0 font-medium">
              <button 
                onClick={() => { setActiveTab('all'); setCurrentPage(1); }}
                className={`px-4 py-2 border-b-2 transition-all cursor-pointer ${
                  activeTab === 'all' 
                    ? 'border-slate-900 text-slate-950 font-bold' 
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                All Wards
              </button>
              <button 
                onClick={() => { setActiveTab('mombasa'); setCurrentPage(1); }}
                className={`px-4 py-2 border-b-2 transition-all cursor-pointer ${
                  activeTab === 'mombasa' 
                    ? 'border-slate-900 text-slate-950 font-bold' 
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                Mombasa
              </button>
              <button 
                onClick={() => { setActiveTab('locations'); setCurrentPage(1); }}
                className={`px-4 py-2 border-b-2 transition-all cursor-pointer ${
                  activeTab === 'locations' 
                    ? 'border-slate-900 text-slate-950 font-bold' 
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                Other Wards
              </button>
            </div>
          </div>
        </div>

        {/* Real responsive Table container */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4 w-10">
                  <input 
                    type="checkbox" 
                    className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 w-3.5 h-3.5 cursor-pointer"
                    checked={totalLeadsCount > 0 && selectedRows.length === currentLeadsRows.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="py-3 px-4">Header</th>
                <th className="py-3 px-4">Section Type</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Target (K)</th>
                <th className="py-3 px-4 text-center">Limit (%)</th>
                <th className="py-3 px-4">Reviewer</th>
                <th className="py-3 px-4 w-12 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
              {currentLeadsRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-bold">
                    No matching leads found inside this category division.
                  </td>
                </tr>
              ) : (
                currentLeadsRows.map((lead) => {
                  const isSelected = selectedRows.includes(lead.id || '');
                  const instBadgeStyles = 
                    lead.institution.includes('School') ? 'bg-indigo-50 text-indigo-700 border-indigo-200/50' :
                    lead.institution.includes('Hospital') ? 'bg-rose-50 text-rose-700 border-rose-200/50' :
                    'bg-slate-50 text-slate-600 border-slate-200/50';

                  const labelShort = lead.institution.split(' ').slice(0, 2).join(' ') || 'Business';

                  return (
                    <tr 
                      key={lead.id} 
                      className={`hover:bg-slate-50/70 transition-colors ${isSelected ? 'bg-slate-50/40' : ''}`}
                    >
                      <td className="py-3.5 px-4 flex items-center gap-2">
                        <GripVertical className="w-3.5 h-3.5 text-slate-300 cursor-grab" />
                        <input 
                          type="checkbox" 
                          className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 w-3.5 h-3.5 cursor-pointer"
                          checked={isSelected}
                          onChange={() => toggleSelectRow(lead.id || '')}
                        />
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate">{lead.clientName}</p>
                          <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5">{lead.location}</p>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-0.5 rounded text-[10px] uppercase font-bold border ${instBadgeStyles}`}>
                          {labelShort}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200/50 text-[10px] font-bold">
                          Done
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-900">
                        {Math.round(lead.revenueCollected / 1000)}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-slate-500 font-medium">
                        {Math.round(lead.revenueCollected * 0.08 / 100)}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-slate-200 text-[10px] font-bold text-slate-700 flex items-center justify-center">
                            {lead.resellerName.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-slate-700 truncate max-w-[120px]">
                            {lead.resellerName}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button className="text-slate-400 hover:text-slate-600 cursor-pointer">
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginated Footer controls - matches the screenshot precisely */}
        <div className="px-6 py-4.5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/30">
          <div className="text-[11px] text-slate-500 font-semibold font-mono">
            {selectedRows.length} of {totalLeadsCount} row(s) selected.
          </div>

          <div className="flex flex-wrap items-center gap-6">
            
            {/* Rows selector */}
            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-semibold">
              <span>Rows per page</span>
              <select 
                value={rowsPerPage} 
                onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                className="bg-white border border-slate-200 rounded px-1.5 py-0.5 font-bold text-slate-800 outline-none"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
              </select>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center gap-4 text-[11px] text-slate-500 font-semibold">
              <span>Page {currentPage} of {totalPages}</span>
              <div className="flex items-center gap-1">
                {/* Chevrons left */}
                <button 
                  disabled={currentPage === 1}
                  className="p-1 border border-slate-200 bg-white hover:bg-slate-50 rounded disabled:opacity-40 cursor-pointer text-slate-600"
                  onClick={() => setCurrentPage(1)}
                >
                  <ChevronsLeft className="w-3.5 h-3.5" />
                </button>
                <button 
                  disabled={currentPage === 1}
                  className="p-1 border border-slate-200 bg-white hover:bg-slate-50 rounded disabled:opacity-40 cursor-pointer text-slate-600"
                  onClick={() => setCurrentPage(currentPage - 1)}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button 
                  disabled={currentPage === totalPages}
                  className="p-1 border border-slate-200 bg-white hover:bg-slate-50 rounded disabled:opacity-40 cursor-pointer text-slate-600"
                  onClick={() => setCurrentPage(currentPage + 1)}
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button 
                  disabled={currentPage === totalPages}
                  className="p-1 border border-slate-200 bg-white hover:bg-slate-50 rounded disabled:opacity-40 cursor-pointer text-slate-600"
                  onClick={() => setCurrentPage(totalPages)}
                >
                  <ChevronsRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

          </div>
        </div>

      </section>

      {/* AUDIT BOARD FEEDBACK REVIEWS TIMELINE */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
        
        <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
          <div>
            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-widest leading-none">OVERSIGHT WEEKLY AUDIT BOARD</h3>
            <p className="text-[10px] text-slate-400 font-semibold mt-1.5">Track advancements & approve support comments</p>
          </div>
          <span className="text-[10px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded border border-slate-200">
            {reports.length} Filed Reportings
          </span>
        </div>

        {reports.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs font-semibold">
            No active weekly reports found in Cloud DB. Affiliates generate reports from Reseller boards.
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => {
              const resellerUser = resellers.find(r => r.uid === report.resellerId);
              const matchingPlan = plans.find(p => p.resellerId === report.resellerId && p.weekStartDate === report.weekStartDate);
              
              return (
                <div key={report.id} className="border border-slate-200 rounded-lg p-5 bg-slate-50/30 space-y-4">
                  
                  {/* Card Title Header details */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-2">
                    <div>
                      <span className="text-xs font-bold text-slate-900 block leading-tight">
                        {resellerUser?.displayName || resellerUser?.email || 'Coast Field Agent'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold font-mono mt-1 block">
                        Division Sectors: {resellerUser?.area || 'Coastal Ward'} • Week Starting: {report.weekStartDate}
                      </span>
                    </div>

                    <span className={`px-2.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border ${
                      report.status === 'reviewed' 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-150' 
                        : 'bg-amber-50 text-amber-700 border-amber-150'
                    }`}>
                      {report.status.replace('_', ' ')}
                    </span>
                  </div>

                  {/* Objective plan matched */}
                  {matchingPlan ? (
                    <div className="text-xs bg-indigo-55 bg-opacity-30 p-3 rounded-lg border border-slate-200">
                      <span className="font-bold text-slate-500 block text-[9.5px] uppercase tracking-wide">Advance Strategy Registered</span>
                      <p className="font-bold text-slate-800 mt-1">"{matchingPlan.objective}"</p>
                      <p className="text-[10px] text-slate-500 italic mt-0.5">Daily breakdown: {matchingPlan.tasks}</p>
                    </div>
                  ) : (
                    <span className="text-[10.5px] text-slate-400 italic block">No advance strategy found for this reseller week period.</span>
                  )}

                  {/* Achievements and hurdles logs */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="bg-emerald-50/20 p-3.5 rounded-lg border border-emerald-100">
                      <strong className="text-emerald-850 text-[10px] uppercase block tracking-wider font-extrabold mb-1">Connections & Achievements</strong>
                      <p className="text-slate-700 font-semibold leading-relaxed">"{report.achievements}"</p>
                    </div>
                    <div className="bg-rose-50/20 p-3.5 rounded-lg border border-rose-100">
                      <strong className="text-rose-850 text-[10px] uppercase block tracking-wider font-extrabold mb-1">Field Hurdles / Blockers</strong>
                      <p className="text-slate-700 font-semibold leading-relaxed">"{report.challenges}"</p>
                    </div>
                  </div>

                  {/* Comments section */}
                  {report.status === 'pending_review' ? (
                    <div className="pt-2">
                      {reviewingReportId === report.id ? (
                        <div className="space-y-3">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Writers supervisor feedback notes:</label>
                          <textarea
                            rows={2}
                            className="w-full p-2.5 border border-slate-200 rounded-lg text-xs outline-none bg-white font-medium focus:ring-1 focus:ring-indigo-500"
                            placeholder="Add recommendations, target adjustments, or congratulations notes..."
                            value={writtenFeedback}
                            onChange={(e) => setWrittenFeedback(e.target.value)}
                          />
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => setReviewingReportId(null)}
                              className="px-3 py-1 rounded bg-slate-200 text-slate-700 text-xs hover:bg-slate-300 font-bold cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleReviewReport(report.id, resellerUser?.email)}
                              className="px-4 py-1 rounded bg-emerald-600 text-white text-xs hover:bg-emerald-700 font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <MessageSquare className="w-3.5 h-3.5" /> Dispatch Commentary Notes
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setReviewingReportId(report.id);
                            setWrittenFeedback('');
                          }}
                          className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                        >
                          Provide Strategy Mentorship Commentary
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs bg-slate-100/50 p-3.5 rounded-lg border border-slate-200">
                      <span className="font-extrabold text-slate-500 text-[9px] uppercase tracking-wider block">Oversight Director Recommendation remarks</span>
                      <p className="italic text-slate-750 mt-1 font-bold">"{report.feedback}"</p>
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        )}

      </section>

    </div>
  );
}
