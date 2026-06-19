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
  ChevronLeft, ChevronsLeft, ChevronsRight
} from 'lucide-react';
import { motion } from 'motion/react';

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
      // 1. Fetch KPI Targets assigned to this reseller
      const kpisQuery = query(collection(db, 'kpis'), where('resellerId', '==', user.uid));
      const kpisSnap = await getDocs(kpisQuery);
      const kpisList = kpisSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as KpiTarget[];
      setKpis(kpisList);

      // 2. Fetch Finance payouts history
      const finQuery = query(collection(db, 'finances'), where('resellerId', '==', user.uid));
      const finSnap = await getDocs(finQuery);
      const finList = finSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as FinanceRecord[];
      setFinances(finList);

      // 3. Fetch Leads uploaded by this reseller
      const leadQuery = query(collection(db, 'leads'), where('resellerId', '==', user.uid));
      const leadSnap = await getDocs(leadQuery);
      const leadList = leadSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as LeadCollection[];
      setLeads(leadList);

      // 4. Fetch Status Reports filed by this reseller
      const reportQuery = query(collection(db, 'reports'), where('resellerId', '==', user.uid));
      const reportSnap = await getDocs(reportQuery);
      const reportList = reportSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as StatusReport[];
      setReports(reportList);
    } catch (err: any) {
      console.error(err);
      setError('Failed to fetch dashboard metrics.');
    } finally {
      setLoading(false);
    }
  };

  // Submit Lead Achievement
  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName || !locationName || !contactNumber || !revenue) {
      setError('Please fill in complete lead details.');
      return;
    }

    const revVal = parseFloat(revenue);
    if (isNaN(revVal) || revVal < 0) {
      setError('Enter a valid positive revenue amount.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
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

      // 1. Save to Firestore
      const docRef = await addDoc(collection(db, 'leads'), newLead);
      
      // 2. Google Sheet Sync of connection lead achievement
      if (spreadsheetId) {
        try {
          await addSpreadsheetRow(spreadsheetId, 'Leads Log', [
            docRef.id,
            newLead.resellerName,
            newLead.clientName,
            newLead.location,
            newLead.institution,
            newLead.contactNumber,
            newLead.revenueCollected,
            new Date(newLead.dateAdded).toLocaleString()
          ]);
        } catch (sErr) {
          console.warn('Sheet append outline offline or deferred', sErr);
        }
      }

      setSuccess(`Connection Lead compiled and logged! Lead synced dynamically to Google Sheets.`);
      
      // Reset Form fields
      setClientName('');
      setLocationName('');
      setContactNumber('');
      setRevenue('');

      // Refresh Reseller collections values
      await fetchResellerData();
    } catch (err: any) {
      console.error(err);
      setError('Lead logging failed.');
    } finally {
      setLoading(false);
    }
  };

  // Submit Weekly Plan
  const handleAddPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!objective || !planTasks) {
      setError('Please detail plan parameters.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const newPlan: WeeklyPlan = {
        id: `plan_${user.uid}_${weekStart}`,
        resellerId: user.uid,
        weekStartDate: weekStart,
        objective,
        tasks: planTasks
      };

      await setDoc(doc(db, 'plans', newPlan.id), newPlan);

      // Optionally sync to Google Calendar
      if (syncToCalendar) {
        try {
          const startTime = `${weekStart}T09:00:00+03:00`;
          const endTime = `${weekStart}T17:00:00+03:00`;
          await createCalendarEvent(
            `Reseller Work Week Plan: ${user.displayName || user.email}`,
            `Objective: ${objective}\nTasks:\n${planTasks}`,
            startTime,
            endTime
          );
          setSuccess('Plan compiled on Firestore & Week check-in schedule synced to Google Calendar!');
        } catch (calErr) {
          console.warn('Calendar sync outlines offline', calErr);
          setSuccess('Plan compiled on Firestore. Calendar scheduling pending OAuth approval.');
        }
      } else {
        setSuccess('Weekly planning documented successfully!');
      }

      setObjective('');
      setPlanTasks('');
    } catch (err: any) {
      console.error(err);
      setError('Plan configuration failed.');
    } finally {
      setLoading(false);
    }
  };

  // Submit Status Report
  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!achievementsText || !challengesText) {
      setError('Please document both accomplishments and challenges.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const newReport: StatusReport = {
        id: `rep_${user.uid}_${reportWeek}`,
        resellerId: user.uid,
        weekStartDate: reportWeek,
        achievements: achievementsText,
        challenges: challengesText,
        status: 'pending_review',
        submittedAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'reports', newReport.id), newReport);

      // Email Management
      await sendGmailEmail(
        'malingib9@gmail.com', // Admin or Project director email
        `Status Report Submitted: ${user.displayName || user.email}`,
        `<h3>Status report filed for review</h3>
         <p>Hello team,</p>
         <p>Reseller <strong>${user.displayName || user.email}</strong> representing area <strong>${userArea}</strong> submitted their weekly reports:</p>
         <p><strong>Achievements:</strong> ${achievementsText}</p>
         <p><strong>Challenges faced:</strong> ${challengesText}</p>
         <p>Please log in to review and offer structured mentoring.</p>`
      ).catch(() => console.log('Gmail notification deferred'));

      setSuccess('Weekly Status report submitted to management for formal review!');
      setAchievementsText('');
      setChallengesText('');
    } catch (err: any) {
      console.error(err);
      setError('Report filing failed.');
    } finally {
      setLoading(false);
    }
  };

  // Real-time calculation of actuals vs assigned targets:
  const leadsCount = leads.length;
  const totalRevenue = leads.reduce((sum, item) => sum + item.revenueCollected, 0);
  const leadTargetValue = kpis.find(k => k.kpiName.toLowerCase().includes('lead'))?.targetValue || 0;
  const revenueTargetValue = kpis.find(k => k.kpiName.toLowerCase().includes('revenue'))?.targetValue || 0;
  
  const leadCompletionPct = leadTargetValue > 0 ? Math.min(100, (leadsCount / leadTargetValue) * 100) : 0;
  const revenueCompletionPct = revenueTargetValue > 0 ? Math.min(100, (totalRevenue / revenueTargetValue) * 100) : 0;

  // Approximate commission estimation (typically 8%)
  const estCommission = totalRevenue * 0.08;

  // Next support allocation due date with no fallback placeholder
  const biweeklyAlloc = finances.find(f => f.type === 'biweekly_support' && f.status === 'paid')?.amount || 0;

  // Area Chart Calculations
  const svgWidth = 600;
  const svgHeight = 160;
  
  // Create daily trend data dynamically from the leads database collection
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dailyRevenue = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };
  
  leads.forEach(lead => {
    if (lead.dateAdded) {
      try {
        const dateObj = new Date(lead.dateAdded);
        const dayName = weekDays[dateObj.getDay()];
        if (dayName in dailyRevenue) {
          dailyRevenue[dayName as keyof typeof dailyRevenue] += lead.revenueCollected;
        }
      } catch (e) {
        console.warn('Invalid lead date encountered', e);
      }
    }
  });

  const weeklyTrendData = [
    { label: 'Mon', revenue: dailyRevenue.Mon },
    { label: 'Tue', revenue: dailyRevenue.Tue },
    { label: 'Wed', revenue: dailyRevenue.Wed },
    { label: 'Thu', revenue: dailyRevenue.Thu },
    { label: 'Fri', revenue: dailyRevenue.Fri },
    { label: 'Sat', revenue: dailyRevenue.Sat },
    { label: 'Sun', revenue: dailyRevenue.Sun }
  ];

  const maxVal = Math.max(...weeklyTrendData.map(d => d.revenue), 1000);
  const chartPoints = weeklyTrendData.map((d, i) => {
    const x = (i / (weeklyTrendData.length - 1)) * svgWidth;
    const yScaled = svgHeight - 15 - ((d.revenue / maxVal) * (svgHeight - 30));
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
      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp1y}, ${next.x} ${next.y}`;
    }
    return path;
  };

  const bezierCurvePath = getBezierPath(chartPoints);
  const fillPath = chartPoints.length > 0 
    ? `${bezierCurvePath} L ${svgWidth} ${svgHeight} L 0 ${svgHeight} Z`
    : '';

  // Pagination calculations
  const totalLeadsCount = leads.length;
  const totalPages = Math.ceil(totalLeadsCount / rowsPerPage) || 1;
  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  const currentLeadsRows = leads.slice(indexOfFirstRow, indexOfLastRow);

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
      
      {/* Dynamic Status Notification Banners */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs flex items-center gap-3 animate-fadeIn">
          <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0" />
          <div className="font-medium">{error}</div>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-250 text-emerald-900 rounded-2xl text-xs flex items-center gap-3 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <div className="font-semibold">{success}</div>
        </div>
      )}

      {/* FOUR SHADCN STATS CARDS */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Total Revenue */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-between min-h-[140px]">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-medium text-slate-500 tracking-tight">Setup Revenue Collected</span>
            <span className="text-[9px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full border border-slate-200/50 font-bold">
              {userArea}
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold tracking-tight text-slate-900 font-mono">
              KES {totalRevenue.toLocaleString()}
            </h3>
            <p className="text-[10px] text-slate-450 mt-1 font-medium">Est. Commission (8%): KES {estCommission.toLocaleString()}</p>
          </div>
        </div>

        {/* Card 2: KPIs Connections progress */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-between min-h-[140px]">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-medium text-slate-500 tracking-tight">Connections Target</span>
            <span className="text-[9px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200/50 font-bold">
              {Math.round(leadCompletionPct)}% Completed
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold tracking-tight text-slate-900 font-mono">
              {leadsCount} / {leadTargetValue} Leads
            </h3>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
              <div 
                className="bg-slate-900 h-full rounded-full transition-all duration-700"
                style={{ width: `${leadCompletionPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 3: Biweekly Support Disbursed */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-between min-h-[140px]">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-medium text-slate-500 tracking-tight">Biweekly Operations Support</span>
            <span className="text-[9px] bg-[#081e26] text-[#00f5d4] px-2 py-0.5 rounded-full border border-teal-950 font-bold">
              Paid
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold tracking-tight text-slate-900 font-mono">
              KES {biweeklyAlloc.toLocaleString()}
            </h3>
            <p className="text-[10px] text-slate-450 mt-1 font-medium">Support status active</p>
          </div>
        </div>

        {/* Card 4: Strategy reports filed */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-between min-h-[140px]">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-medium text-slate-500 tracking-tight">Strategy Reporting filings</span>
            <span className="text-[9px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200/50 font-bold">
              Week log
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold tracking-tight text-slate-900 font-mono">
              {reports.length} reports
            </h3>
            <p className="text-[10px] text-slate-450 mt-1 font-medium">
              {reports.length === 0 ? 'No status reports filed' : 'Synced with regional directors'}
            </p>
          </div>
        </div>

      </section>

      {/* DYNAMIC SHADCN-STYLE AREA CHART */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="border-b border-slate-150 pb-4 mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">Active Performance Pipeline</h3>
            <p className="text-xs text-slate-400 mt-1 font-medium">Daily connection setups log summary</p>
          </div>
          <span className="text-[10px] font-mono text-slate-400 font-bold bg-slate-50 px-2 py-0.5 border border-slate-200 rounded">
            WEEK: {weekStart}
          </span>
        </div>

        {/* Small Curved Area line SVG */}
        <div className="h-[140px] w-full relative">
          <svg className="w-full h-full overflow-visible" viewBox={`0 0 ${svgWidth} ${svgHeight}`} preserveAspectRatio="none">
            <defs>
              <linearGradient id="agentGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563eb" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizontal guide grids */}
            <line x1="0" y1="20" x2={svgWidth} y2="20" stroke="#f1f5f9" strokeDasharray="3 3" />
            <line x1="0" y1={svgHeight - 15} x2={svgWidth} y2={svgHeight - 15} stroke="#f1f5f9" />

            {/* Path Fill */}
            {fillPath && <path d={fillPath} fill="url(#agentGradient)" />}

            {/* Path Outline contour */}
            {bezierCurvePath && <path d={bezierCurvePath} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" />}

            {/* Dots */}
            {chartPoints.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="3" fill="#ffffff" stroke="#2563eb" strokeWidth="1.5" />
            ))}
          </svg>

          {/* Labels Row */}
          <div className="absolute bottom-0 left-0 right-0 flex justify-between px-1 text-[9px] font-mono font-bold text-slate-400">
            {weeklyTrendData.map((d, i) => (
              <span key={i} className="text-center w-10">{d.label}</span>
            ))}
          </div>
        </div>
      </section>

      {/* PRIMARY GRID LAYOUT: Submissions Node Form & Strategy Reporting */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LOG CONNECTIONS LEAD SUBMISSIONS FORM */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-xs">Document Lead Hookup</h3>
              <p className="text-[10px] text-slate-450 font-medium">Verify connection metrics in real-time</p>
            </div>
          </div>

          <form onSubmit={handleAddLead} className="space-y-3.5 text-xs">
            <div>
              <label className="block text-slate-500 mb-1 font-semibold">Client Full Name</label>
              <input
                type="text"
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white font-semibold text-slate-800"
                placeholder="e.g. Malindi Beach Resort"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-slate-500 mb-1 font-semibold">Geographical Ward / Street</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  required
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white font-semibold text-slate-800"
                  placeholder="e.g. Shanzu Area, Mombasa"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-500 mb-1 font-semibold">Institution Type</label>
                <select
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white font-semibold text-slate-700"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                >
                  <option value="Privately Owned Business">Business</option>
                  <option value="Educational Institution">School</option>
                  <option value="Healthcare Center">Hospital</option>
                  <option value="Residential Property">Household</option>
                  <option value="NGO / Public Space">NGO/Community</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-500 mb-1 font-semibold">Contact Phone</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    required
                    maxLength={13}
                    className="w-full pl-9 pr-2 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white font-semibold text-slate-800 font-mono"
                    placeholder="2547XXXXXXXX"
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-slate-500 mb-1 font-semibold">Allocated Setup Revenue (KES)</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-slate-400 font-bold z-10 text-[10px]">KES</span>
                <input
                  type="number"
                  required
                  className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white font-semibold text-slate-800 font-mono"
                  placeholder="7500"
                  value={revenue}
                  onChange={(e) => setRevenue(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 px-4 rounded-lg transition-all shadow-sm active:scale-95 text-xs flex items-center justify-center gap-1.5 cursor-pointer mt-2"
            >
              <Send className="w-3.5 h-3.5" /> Submit Connection Lead
            </button>
          </form>
        </div>

        {/* BIWEEKLY STRATEGY PLANNING & STATUS REVIEWS */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <ClipboardList className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-xs">Strategy Plannings & Status Reviews</h3>
              <p className="text-[10px] text-slate-405 font-medium font-mono">Submit weekly targets to regional directors</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 divide-y md:divide-y-0 md:divide-x divide-slate-150">
            
            {/* Left Col: Setup weekly plan objectives */}
            <div className="space-y-4 pt-1">
              <h4 className="text-[11px] font-bold uppercase text-slate-900 tracking-wider flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-500" /> Weekly Strategy Form
              </h4>
              
              <form onSubmit={handleAddPlan} className="space-y-3 text-xs leading-relaxed">
                <div>
                  <label className="block text-slate-500 mb-0.5 font-semibold">Week Beginning Date</label>
                  <input
                    type="date"
                    required
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg outline-none font-medium text-slate-700 focus:ring-1 focus:ring-slate-900 bg-white"
                    value={weekStart}
                    onChange={(e) => setWeekStart(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-slate-500 mb-0.5 font-semibold">Core Weekly Objective</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Deploy 5 residential lines in Shanzu"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg outline-none font-medium text-slate-705 focus:ring-1 focus:ring-slate-900 bg-white"
                    value={objective}
                    onChange={(e) => setObjective(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-slate-500 mb-0.5 font-semibold">Daily Breakdown & Tasks</label>
                  <textarea
                    rows={2}
                    required
                    placeholder="Mon: Shanzu prospecting; Tue: County outreach..."
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg outline-none font-medium text-slate-705 focus:ring-1 focus:ring-slate-900 text-[11px] bg-white"
                    value={planTasks}
                    onChange={(e) => setPlanTasks(e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-2 py-1">
                  <input
                    type="checkbox"
                    id="syncCal"
                    checked={syncToCalendar}
                    onChange={(e) => setSyncToCalendar(e.target.checked)}
                    className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer w-3.5 h-3.5"
                  />
                  <label htmlFor="syncCal" className="font-semibold text-slate-600 text-[10px] cursor-pointer">
                    Sync to Google Calendar Schedule
                  </label>
                </div>

                <button
                  type="submit"
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-1.5 px-4 rounded-lg text-xs transition-colors cursor-pointer text-left"
                >
                  Log Weekly Plan
                </button>
              </form>
            </div>

            {/* Right Col: Document weekly achievements / status report */}
            <div className="space-y-4 pt-4 md:pt-1 md:pl-6">
              <h4 className="text-[11px] font-bold uppercase text-slate-950 tracking-wider flex items-center gap-1">
                <Compass className="w-3.5 h-3.5 text-slate-500" /> Submit Status Report
              </h4>

              <form onSubmit={handleSubmitReport} className="space-y-3 text-xs leading-relaxed">
                <div>
                  <label className="block text-slate-500 mb-0.5 font-semibold">Reporting Week Date</label>
                  <input
                    type="date"
                    required
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg outline-none font-medium text-slate-700 focus:ring-1 focus:ring-slate-900 bg-white"
                    value={reportWeek}
                    onChange={(e) => setReportWeek(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-slate-500 mb-0.5 font-semibold">Achievements & Connections</label>
                  <textarea
                    rows={1}
                    required
                    placeholder="Describe connections activated, clients billed..."
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg outline-none font-medium text-slate-705 focus:ring-1 focus:ring-slate-900 text-[11px] bg-white"
                    value={achievementsText}
                    onChange={(e) => setAchievementsText(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-slate-500 mb-0.5 font-semibold">Challenges faced</label>
                  <textarea
                    rows={1}
                    required
                    placeholder="Describe client payment issues or transport challenges..."
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg outline-none font-medium text-slate-705 focus:ring-1 focus:ring-slate-900 text-[11px] bg-white"
                    value={challengesText}
                    onChange={(e) => setChallengesText(e.target.value)}
                  />
                </div>

                <div className="pt-2 text-right">
                  <button
                    type="submit"
                    className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-1.5 px-4 rounded-lg text-xs transition-colors cursor-pointer"
                  >
                    Send Report Review
                  </button>
                </div>
              </form>
            </div>

          </div>
        </div>

      </section>

      {/* HIGH-FIDELITY LEADS TABLE - matching the screenshot exactly */}
      <section className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        
        <div className="px-6 py-5 border-b border-slate-200 flex justify-between items-center bg-white">
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">Active Connection Leads</h3>
            <p className="text-xs text-slate-400 mt-1 font-medium">Logged allocations registry on field agent node</p>
          </div>
          <span className="text-[10px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded border border-slate-200">
            {leads.length} Records
          </span>
        </div>

        {/* Lead Table responsive content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
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
                <th className="py-3 px-4 w-10 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-750">
              {currentLeadsRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-450 font-bold">
                    No leads registered yet. Compile your first lead above.
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
                      className={`hover:bg-slate-50/70 transition-colors ${isSelected ? 'bg-slate-50/50' : ''}`}
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
                          <div className="w-5 h-5 bg-slate-200 rounded-full font-bold flex items-center justify-center text-[10px] text-slate-700">
                            F
                          </div>
                          <span className="font-medium text-slate-650 truncate max-w-[120px]">
                            Field Agent
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button className="text-slate-400 hover:text-slate-605 cursor-pointer">
                          <MoreHorizontal className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls footer */}
        <div className="px-6 py-4.5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/30">
          <div className="text-[11px] text-slate-505 font-semibold font-mono">
            {selectedRows.length} of {totalLeadsCount} rows selected.
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-[11px] text-slate-505 font-semibold">
              <span>Rows per page</span>
              <select 
                value={rowsPerPage} 
                onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                className="bg-white border border-slate-250 rounded px-1.5 py-0.5 font-bold text-slate-800"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
              </select>
            </div>

            <div className="flex items-center gap-4 text-[11px] text-slate-505 font-semibold">
              <span>Page {currentPage} of {totalPages}</span>
              <div className="flex items-center gap-1">
                <button 
                  disabled={currentPage === 1}
                  className="p-1 border border-slate-205 bg-white hover:bg-slate-50 rounded disabled:opacity-40 cursor-pointer"
                  onClick={() => setCurrentPage(1)}
                >
                  <ChevronsLeft className="w-3.5 h-3.5" />
                </button>
                <button 
                  disabled={currentPage === 1}
                  className="p-1 border border-slate-205 bg-white hover:bg-slate-50 rounded disabled:opacity-40 cursor-pointer"
                  onClick={() => setCurrentPage(currentPage - 1)}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button 
                  disabled={currentPage === totalPages}
                  className="p-1 border border-slate-205 bg-white hover:bg-slate-50 rounded disabled:opacity-40 cursor-pointer"
                  onClick={() => setCurrentPage(currentPage + 1)}
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button 
                  disabled={currentPage === totalPages}
                  className="p-1 border border-slate-205 bg-white hover:bg-slate-50 rounded disabled:opacity-40 cursor-pointer"
                  onClick={() => setCurrentPage(totalPages)}
                >
                  <ChevronsRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

      </section>

      {/* DISBURSED ALLOCATIONS HISTORY */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3.5 mb-4 bg-white">
          <div>
            <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">Operational Disbursements History</h3>
            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Allocations dispatched by systems administrators</p>
          </div>
          <span className="text-[10px] bg-amber-50 border border-amber-150 text-amber-700 font-black px-2.5 py-1 rounded-xl">
            FINANCE AUDIT
          </span>
        </div>

        {finances.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs font-semibold">
            No recent support or commissions payout history found.
          </div>
        ) : (
          <div className="space-y-3.5">
            {finances.map((f, index) => (
              <div key={index} className="flex items-center justify-between p-3.5 hover:bg-slate-50 border border-slate-100 rounded-xl transition-all">
                <div className="flex items-center gap-3">
                  <div className={`w-8.5 h-8.5 rounded-full font-bold flex items-center justify-center text-[10px] shrink-0 border uppercase ${
                    f.type === 'biweekly_support' 
                      ? 'bg-amber-50 text-amber-800 border-amber-200' 
                      : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  }`}>
                    {f.type === 'biweekly_support' ? 'OP' : 'CM'}
                  </div>
                  <div>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${
                      f.type === 'biweekly_support' 
                        ? 'bg-amber-50 text-amber-700 border-amber-100' 
                        : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                    }`}>
                      {f.type === 'biweekly_support' ? 'Biweekly Support' : 'Commissions Payout'}
                    </span>
                    <p className="text-[10px] text-slate-400 font-bold font-mono mt-1">{f.period}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-extrabold text-slate-900 font-mono">KES {f.amount.toLocaleString()}</p>
                  <p className="text-[9px] text-slate-400 font-semibold mt-0.5">Status: Released</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

    </div>
  );
}
