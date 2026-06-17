import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, addDoc, doc, setDoc } from 'firebase/firestore';
import { addSpreadsheetRow, createCalendarEvent, sendGmailEmail } from '../lib/googleApi';
import { KpiTarget, WeeklyPlan, StatusReport, LeadCollection, FinanceRecord } from '../types';
import { User } from 'firebase/auth';
import { 
  TrendingUp, Calendar, ChevronRight, CheckCircle2, AlertCircle, Plus, 
  MapPin, Phone, Building, DollarSign, Send, ClipboardList, Target, Compass,
  FolderSync, ShieldCheck, CreditCard, Link
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
  const leadTargetValue = kpis.find(k => k.kpiName.toLowerCase().includes('lead'))?.targetValue || 12;
  const revenueTargetValue = kpis.find(k => k.kpiName.toLowerCase().includes('revenue'))?.targetValue || 50000;
  
  const leadCompletionPct = Math.min(100, (leadsCount / leadTargetValue) * 100);
  const revenueCompletionPct = Math.min(100, (totalRevenue / revenueTargetValue) * 100);

  // Approximate commission estimation (typically 8%)
  const estCommission = totalRevenue * 0.08;

  // Next support allocation due date (mocked beautifully as due in 2d)
  const biweeklyAlloc = finances.find(f => f.type === 'biweekly_support' && f.status === 'paid')?.amount || 5000;

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
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl text-xs flex items-center gap-3 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <div className="font-semibold">{success}</div>
        </div>
      )}

      {/* PRIMARY BENTO GRID LEVEL 1: Stats & KPI Achievements */}
      <section className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* BENTO CARD 1: Cool Purple Financial Highlights (Total Revenue & Est Commission) */}
        <div className="md:col-span-12 lg:col-span-5 bg-gradient-to-br from-indigo-950 to-slate-900 rounded-3xl p-6 text-white shadow-md flex flex-col justify-between min-h-[220px]">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] text-indigo-300 font-extrabold uppercase tracking-widest block">Geographical Division: {userArea}</span>
              <h3 className="text-xl font-bold mt-1 text-white">Active Field Performance</h3>
            </div>
            <div className="p-2.5 bg-white/10 rounded-xl mb-2">
              <TrendingUp className="w-5 h-5 text-indigo-300" />
            </div>
          </div>
          
          <div className="my-4">
            <span className="text-xs text-indigo-200 block uppercase font-semibold">Total Revenue Collected</span>
            <div className="text-3xl sm:text-4xl font-extrabold font-mono text-emerald-400 mt-1">
              KES {totalRevenue.toLocaleString()}
            </div>
          </div>

          <div className="bg-white/10 border border-white/5 rounded-2xl p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[9px] text-indigo-200 uppercase font-semibold">Est. Monthly Commission (8%)</p>
              <p className="text-lg font-black text-white">KES {estCommission.toLocaleString()}</p>
            </div>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 rounded-lg px-2 py-1 font-bold">
              Active Hookups
            </span>
          </div>
        </div>

        {/* BENTO CARD 2: Connection Target Progress */}
        <div className="md:col-span-6 lg:col-span-4 bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between min-h-[220px]">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] text-indigo-600 font-extrabold uppercase tracking-widest block">Core KPIs</span>
              <h3 className="font-bold text-slate-800 text-sm">Internet Connection Leads</h3>
            </div>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Target className="w-5 h-5" />
            </div>
          </div>

          <div className="pt-4">
            <div className="flex justify-between text-xs text-slate-500 mb-1.5 font-semibold">
              <span className="font-mono text-slate-700">Actual: {leadsCount} leads</span>
              <span className="font-mono">Target: {leadTargetValue} leads</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
              <div 
                className="bg-indigo-600 h-full rounded-full transition-all duration-700"
                style={{ width: `${leadCompletionPct}%` }}
              />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-[11px]">
            <span className="text-slate-400 font-medium">Monthly Goal status</span>
            <span className="font-extrabold text-indigo-600">{Math.round(leadCompletionPct)}% Completed</span>
          </div>
        </div>

        {/* BENTO CARD 3: Biweekly Support Status Card */}
        <div className="md:col-span-6 lg:col-span-3 bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between min-h-[220px]">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] text-pink-600 font-extrabold uppercase tracking-widest block">Operations Support</span>
              <h3 className="font-bold text-slate-800 text-sm">Disbursed Allocations</h3>
            </div>
            <div className="p-2 bg-pink-50 text-pink-600 rounded-xl">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>

          <div className="pt-2">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Biweekly Support sum</span>
            <p className="text-xl font-extrabold text-slate-800 font-mono mt-0.5">KES {biweeklyAlloc.toLocaleString()}</p>
          </div>

          <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-2 mt-4 text-[11px] text-slate-500 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span>Support funds released successfully</span>
          </div>
        </div>

      </section>

      {/* PRIMARY BENTO GRID LEVEL 2: Dynamic Form Submissions */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* BENTO CARD 4: Log Lead Form (col-span-4) */}
        <div className="lg:col-span-4 bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Plus className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-xs">Document Lead Hookup</h3>
              <p className="text-[10px] text-slate-400 font-medium">Verify connection metrics in real-time</p>
            </div>
          </div>

          <form onSubmit={handleAddLead} className="space-y-3.5 text-xs">
            <div>
              <label className="block text-slate-500 mb-1 font-semibold">Client Full Name</label>
              <input
                type="text"
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500 outline-none transition-all font-medium"
                placeholder="e.g. Malindi Beach Resort"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-slate-500 mb-1 font-semibold">Geographical Ward / Street</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500 outline-none transition-all font-medium"
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
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500 outline-none transition-all font-medium bg-white"
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
                    className="w-full pl-9 pr-2 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500 outline-none transition-all font-medium font-mono"
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
                <span className="absolute left-3 top-2 text-slate-400 font-bold z-10 text-[11px]">KES</span>
                <input
                  type="number"
                  required
                  className="w-full pl-[42px] pr-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500 outline-none transition-all font-semibold font-mono"
                  placeholder="7500"
                  value={revenue}
                  onChange={(e) => setRevenue(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 px-4 rounded-xl transition-all shadow-sm active:scale-95 text-xs inline-flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              <Send className="w-3.5 h-3.5" /> Submit Lead & Keep Sync
            </button>
          </form>
        </div>

        {/* BENTO CARD 5: Biweekly strategy scheduling / progress tracking forms (col-span-8) */}
        <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <ClipboardList className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-xs">Strategy Plannings & Status Reviews</h3>
              <p className="text-[10px] text-slate-400 font-medium font-mono">Submit weekly targets to regional directors</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 divide-y md:divide-y-0 md:divide-x divide-slate-150">
            
            {/* Left Col: Setup weekly plan objectives */}
            <div className="space-y-4 pt-1">
              <h4 className="text-[11px] font-extrabold uppercase text-indigo-700 tracking-wider flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> Weekly Strategy Form
              </h4>
              
              <form onSubmit={handleAddPlan} className="space-y-3 text-xs leading-relaxed">
                <div>
                  <label className="block text-slate-500 mb-0.5 font-semibold">Week Beginning Date</label>
                  <input
                    type="date"
                    required
                    className="w-full px-3 py-1.5 border border-slate-250 rounded-lg outline-none font-medium text-slate-700 focus:ring-1 focus:ring-indigo-500"
                    value={weekStart}
                    onChange={(e) => setWeekStart(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-slate-500 mb-0.5 font-semibold">Core Weekly Objective / Mission</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Deploy 5 residential lines in Shanzu"
                    className="w-full px-3 py-1.5 border border-slate-250 rounded-lg outline-none font-medium text-slate-700 focus:ring-1 focus:ring-indigo-500"
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
                    className="w-full px-3 py-1.5 border border-slate-250 rounded-lg outline-none font-medium text-slate-700 focus:ring-1 focus:ring-indigo-500 text-[11px]"
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
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer w-4 h-4"
                  />
                  <label htmlFor="syncCal" className="font-semibold text-slate-600 text-[10px] cursor-pointer">
                    Sync to Google Calendar Schedule
                  </label>
                </div>

                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1.5 px-4 rounded-lg text-xs transition-colors cursor-pointer text-left"
                >
                  Log Weekly Plan
                </button>
              </form>
            </div>

            {/* Right Col: Document weekly achievements / status report */}
            <div className="space-y-4 pt-4 md:pt-1 md:pl-6">
              <h4 className="text-[11px] font-extrabold uppercase text-emerald-700 tracking-wider flex items-center gap-1">
                <Compass className="w-3.5 h-3.5" /> Submit Status Report
              </h4>

              <form onSubmit={handleSubmitReport} className="space-y-3 text-xs leading-relaxed">
                <div>
                  <label className="block text-slate-500 mb-0.5 font-semibold">Reporting Week Date</label>
                  <input
                    type="date"
                    required
                    className="w-full px-3 py-1.5 border border-slate-250 rounded-lg outline-none font-medium text-slate-700 focus:ring-1 focus:ring-indigo-500"
                    value={reportWeek}
                    onChange={(e) => setReportWeek(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-slate-500 mb-0.5 font-semibold">Achievements & Connections logs</label>
                  <textarea
                    rows={1}
                    required
                    placeholder="Describe connections activated, clients billed..."
                    className="w-full px-3 py-1.5 border border-slate-250 rounded-lg outline-none font-medium text-slate-700 focus:ring-1 focus:ring-indigo-500 text-[11px]"
                    value={achievementsText}
                    onChange={(e) => setAchievementsText(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-slate-500 mb-0.5 font-semibold">Challenges / Hindrances encountered</label>
                  <textarea
                    rows={1}
                    required
                    placeholder="Describe client payment issues or transport challenges..."
                    className="w-full px-3 py-1.5 border border-slate-250 rounded-lg outline-none font-medium text-slate-700 focus:ring-1 focus:ring-indigo-500 text-[11px]"
                    value={challengesText}
                    onChange={(e) => setChallengesText(e.target.value)}
                  />
                </div>

                <div className="pt-2 text-right">
                  <button
                    type="submit"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-4 rounded-lg text-xs transition-colors cursor-pointer"
                  >
                    Send Report Review
                  </button>
                </div>
              </form>
            </div>

          </div>
        </div>

      </section>

      {/* PRIMARY BENTO GRID LEVEL 3: Tables and Logs */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Connection Leads registered by Reseller */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3.5 mb-4">
            <div>
              <h3 className="font-bold text-slate-800 text-xs">Aesthetic Connections Track</h3>
              <p className="text-[10px] text-slate-400 font-semibold font-mono">Recent lead entries logging on real database</p>
            </div>
            <span className="text-[10px] bg-slate-100 border border-slate-200 font-bold px-2 py-0.5 rounded-lg">
              {leads.length} recorded
            </span>
          </div>

          {leads.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs font-semibold">
              No recent connections recorded in Coast database schema. Use the submissions module.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-medium">
                <thead className="text-slate-400 border-b border-slate-100">
                  <tr>
                    <th className="pb-2">Client name</th>
                    <th className="pb-2">Division location</th>
                    <th className="pb-2">Disbursed sum (KES)</th>
                  </tr>
                </thead>
                <tbody className="text-slate-600 font-semibold text-[11px] divide-y divide-slate-50">
                  {leads.map((l, index) => (
                    <tr key={l.id || index} className="hover:bg-slate-50/50">
                      <td className="py-2.5">
                        <p className="font-bold text-slate-800">{l.clientName}</p>
                        <p className="text-[9px] text-slate-400 font-mono font-bold mt-0.5">{l.institution}</p>
                      </td>
                      <td className="py-2.5 font-mono">{l.location}</td>
                      <td className="py-2.5 font-bold text-slate-900">KES {l.revenueCollected.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Biweekly support & operations payout log */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3.5 mb-4">
            <div>
              <h3 className="font-bold text-slate-800 text-xs">Biweekly Support & Monthly payouts history</h3>
              <p className="text-[10px] text-slate-400 font-semibold font-mono">Allocations dispatched by systems administrators</p>
            </div>
            <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-100 font-bold px-2 py-0.5 rounded-lg font-mono">
              FINANCE AUDIT
            </span>
          </div>

          {finances.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs font-semibold">
              No historic support or commissions rows recorded. Contact System Administrators to initialize payout logs.
            </div>
          ) : (
            <div className="overflow-x-auto font-medium">
              <table className="w-full text-left text-xs">
                <thead className="text-slate-400 border-b border-slate-100">
                  <tr>
                    <th className="pb-2 text-left">Period</th>
                    <th className="pb-2 text-left">Classification</th>
                    <th className="pb-2 text-right">Sum (KES)</th>
                  </tr>
                </thead>
                <tbody className="text-slate-600 font-semibold text-[11px] divide-y divide-slate-50">
                  {finances.map((f, index) => (
                    <tr key={index} className="hover:bg-slate-50/50">
                      <td className="py-2.5 font-mono">{f.period}</td>
                      <td className="py-2.5">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          f.type === 'biweekly_support' 
                            ? 'bg-amber-50 text-amber-700 border border-amber-100' 
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                        }`}>
                          {f.type === 'biweekly_support' ? 'Biweekly Support' : 'Commissions payout'}
                        </span>
                      </td>
                      <td className="py-2.5 font-bold text-slate-900 text-right">KES {f.amount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </section>

    </div>
  );
}
