import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, addDoc, doc, updateDoc, query, where } from 'firebase/firestore';
import { sendGmailEmail } from '../lib/googleApi';
import { UserProfile, KpiTarget, WeeklyPlan, StatusReport, LeadCollection, CoastArea } from '../types';
import { 
  Building, UserCheck, BarChart3, Calendar, ClipboardCheck, DollarSign, 
  Map, Target, ArrowUpRight, MessageSquare, Plus, AlertCircle, CheckCircle2,
  TrendingUp, Star, Users, Flame
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

  // Allocate KPI Form State
  const [targetReseller, setTargetReseller] = useState('');
  const [selectedKpiName, setSelectedKpiName] = useState('Active Lead Connections');
  const [targetVal, setTargetVal] = useState('');
  const [targetPeriod, setTargetPeriod] = useState('2026 June');

  // Feedback State for reviews
  const [reviewingReportId, setReviewingReportId] = useState<string | null>(null);
  const [writtenFeedback, setWrittenFeedback] = useState('');

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
  // Coast areas: Mombasa, Malindi, Kilifi, Kwale, Lamu, Tana River
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

  // Aggregate collected lead counts & revenues inside the Coast Sub-areas
  leads.forEach(lead => {
    // Try to match area in the lead location string (e.g. "Mombasa Old Town" -> Mombasa)
    let assigned = false;
    for (const area of coastAreas) {
      if (lead.location.toLowerCase().includes(area.toLowerCase())) {
        areaDataMap[area].revenue += lead.revenueCollected;
        areaDataMap[area].leadsCount += 1;
        assigned = true;
        break;
      }
    }
    // Fallback if area wasn't specified accurately, assign based on reseller area if registered
    if (!assigned) {
      const parentUser = resellers.find(r => r.uid === lead.resellerId);
      if (parentUser?.area && areaDataMap[parentUser.area]) {
        areaDataMap[parentUser.area].revenue += lead.revenueCollected;
        areaDataMap[parentUser.area].leadsCount += 1;
      } else {
        // Default Mombasa
        areaDataMap['Mombasa'].revenue += lead.revenueCollected;
        areaDataMap['Mombasa'].leadsCount += 1;
      }
    }
  });

  // Convert map to array for visual charting rendering
  const areaChartData = coastAreas.map(area => ({
    name: area,
    revenue: areaDataMap[area].revenue,
    leads: areaDataMap[area].leadsCount
  }));

  const maxRevenue = Math.max(...areaChartData.map(d => d.revenue), 10000);

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
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl text-xs flex items-center gap-3 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span className="font-bold">{success}</span>
        </div>
      )}

      {/* THREE BENTO METRIC STATS MODULE */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-700 rounded-xl">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Field Personnel</span>
            <span className="text-xl font-extrabold text-slate-800 tracking-tight">{resellers.length} Resellers</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-700 rounded-xl">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Leads Logged</span>
            <span className="text-xl font-extrabold text-blue-700 tracking-tight">{leads.length} Hookups</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Revenue Managed</span>
            <span className="text-lg font-black text-emerald-600 tracking-tight">
              KES {leads.reduce((s,l)=>s+l.revenueCollected, 0).toLocaleString()}
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-700 rounded-xl">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Reports Queue</span>
            <span className="text-xl font-extrabold text-amber-700 tracking-tight">
              {reports.filter(r => r.status === 'pending_review').length} Pending Review
            </span>
          </div>
        </div>

      </section>

      {/* DUAL MODULE AREA: Chart on left, target setup forms on the right */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Coastal division revenue share (analytical bento card) */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <div>
              <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-widest flex items-center gap-2">
                <Map className="w-4 h-4 text-emerald-600" /> Regional Lead Revenue Distribution
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Setup fee contributions extracted per geographical territory divisions.</p>
            </div>
            <BarChart3 className="w-4.5 h-4.5 text-slate-400" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 pt-2">
            {areaChartData.map((d, index) => {
              const pct = (d.revenue / maxRevenue) * 100;
              return (
                <div key={index} className="space-y-1.5 p-3.5 bg-[#f8fafc] border border-slate-150 rounded-2xl">
                  <div className="flex justify-between text-xs">
                    <span className="font-bold text-slate-800">
                      {d.name}
                    </span>
                    <span className="font-bold text-slate-500 text-[10px]">{d.leads} leads</span>
                  </div>
                  <div className="w-full bg-slate-200/60 rounded-full h-3 overflow-hidden">
                    <div 
                      className="bg-indigo-600 h-full rounded-full transition-all duration-700"
                      style={{ width: `${Math.max(4, pct)}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-slate-400">
                    <span>Revenue Share</span>
                    <span className="font-extrabold text-slate-900 font-mono">KES {d.revenue.toLocaleString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Allocate performance target form */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
              <Target className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-xs">Assign Performance KPI</h3>
              <p className="text-[10px] text-slate-400">Configure targets on reseller nodes</p>
            </div>
          </div>

          {resellers.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center font-bold">Register field members in administrative boards to configure targets.</p>
          ) : (
            <form onSubmit={handleAssignKpi} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-500 font-semibold mb-0.5">Select Reseller Affiliate</label>
                <select
                  required
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none bg-white font-semibold text-slate-700"
                  value={targetReseller}
                  onChange={(e) => setTargetReseller(e.target.value)}
                >
                  {resellers.map(r => (
                    <option key={r.uid} value={r.uid}>{r.displayName} ({r.area || 'No Area Assigned'})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-0.5">KPI Performance Metric</label>
                <select
                  required
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none bg-white font-semibold text-slate-700"
                  value={selectedKpiName}
                  onChange={(e) => setSelectedKpiName(e.target.value)}
                >
                  <option value="Active Lead Connections">Active Lead Connections (Count)</option>
                  <option value="Revenue Contribution">Revenue Contribution (KES)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-0.5">Monthly Objective Limit</label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 15 leads or 50000 KES"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none font-semibold"
                  value={targetVal}
                  onChange={(e) => setTargetVal(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-0.5">Audit Performance Period</label>
                <select
                  required
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none bg-white font-semibold text-slate-700"
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
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 rounded-xl transition-all shadow-sm active:scale-95 text-xs inline-flex items-center justify-center gap-1 cursor-pointer mt-1"
              >
                <Plus className="w-3.5 h-3.5" /> Allocate Milestone Target
              </button>
            </form>
          )}
        </div>

      </section>

      {/* AUDIT BOARD FEEDBACK REVIEWS TIMELINE */}
      <section className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
        
        <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
          <div>
            <h3 className="font-bold text-slate-800 text-xs">OVERSIGHT WEEKLY AUDIT BOARD</h3>
            <p className="text-[10px] text-slate-400 font-semibold">Track advancements & approve support comments</p>
          </div>
          <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-lg border border-indigo-150">
            {reports.length} Filed Reportings
          </span>
        </div>

        {reports.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs font-semibold">
            No active weekly reports found in Cloud DB. Affiliates generate reports from Reseller viewboards.
          </div>
        ) : (
          <div className="space-y-5">
            {reports.map((report) => {
              const resellerUser = resellers.find(r => r.uid === report.resellerId);
              const matchingPlan = plans.find(p => p.resellerId === report.resellerId && p.weekStartDate === report.weekStartDate);
              
              return (
                <div key={report.id} className="border border-slate-200 rounded-2xl p-5 bg-[#f8fafc]/50 space-y-4">
                  
                  {/* Card Title Header details */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-150 pb-2">
                    <div>
                      <span className="text-xs font-bold text-slate-900 block leading-tight">
                        {resellerUser?.displayName || resellerUser?.email || 'Coast Field Agent'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold font-mono mt-0.5">
                        Division Sectors: {resellerUser?.area || 'Coastal Ward'} • Week Starting: {report.weekStartDate}
                      </span>
                    </div>

                    <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider ${
                      report.status === 'reviewed' 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-150' 
                        : 'bg-amber-50 text-amber-700 border border-amber-150'
                    }`}>
                      {report.status.replace('_', ' ')}
                    </span>
                  </div>

                  {/* Objective plan matched */}
                  {matchingPlan ? (
                    <div className="text-xs bg-indigo-50/45 p-3 rounded-xl border border-indigo-100/40">
                      <span className="font-bold text-indigo-700 block text-[9.5px] uppercase tracking-wide">Advance Strategy Registered:</span>
                      <p className="font-bold text-slate-800 mt-0.5">"{matchingPlan.objective}"</p>
                      <p className="text-[10px] text-slate-500 italic mt-0.5">Daily breakdown: {matchingPlan.tasks}</p>
                    </div>
                  ) : (
                    <span className="text-[10.5px] text-slate-400 italic block">No advance strategy found for this reseller week period.</span>
                  )}

                  {/* Achievements and hurdles logs */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="bg-emerald-50/40 p-3.5 rounded-xl border border-emerald-150/40">
                      <strong className="text-emerald-800 text-[10px] uppercase block tracking-wider font-extrabold mb-1">Connections & Achievements:</strong>
                      <p className="text-slate-700 font-medium leading-relaxed">"{report.achievements}"</p>
                    </div>
                    <div className="bg-rose-50/40 p-3.5 rounded-xl border border-rose-150/40">
                      <strong className="text-rose-800 text-[10px] uppercase block tracking-wider font-extrabold mb-1">Field Hurdles / Blockers:</strong>
                      <p className="text-slate-700 font-medium leading-relaxed">"{report.challenges}"</p>
                    </div>
                  </div>

                  {/* Comments section */}
                  {report.status === 'pending_review' ? (
                    <div className="pt-2">
                      {reviewingReportId === report.id ? (
                        <div className="space-y-3">
                          <label className="block text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Writers supervisor feedback notes:</label>
                          <textarea
                            rows={2}
                            className="w-full p-2.5 border border-slate-200 rounded-xl text-xs outline-none bg-white font-medium focus:ring-1 focus:ring-indigo-500"
                            placeholder="Add recommendations, target adjustments, or congratulations notes..."
                            value={writtenFeedback}
                            onChange={(e) => setWrittenFeedback(e.target.value)}
                          />
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => setReviewingReportId(null)}
                              className="px-3 py-1 rounded-lg bg-slate-200 text-slate-700 text-xs hover:bg-slate-300 font-bold cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleReviewReport(report.id, resellerUser?.email)}
                              className="px-4 py-1 rounded-lg bg-emerald-600 text-white text-xs hover:bg-emerald-700 font-bold flex items-center gap-1 cursor-pointer"
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
                          className="px-3.5 py-1.5 border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer"
                        >
                          Provide Strategy Mentorship Commentary
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs bg-slate-100 p-3.5 rounded-xl border border-slate-200">
                      <span className="font-extrabold text-slate-500 text-[9.5px] uppercase tracking-wider block">Oversight Director Recommendation remarks:</span>
                      <p className="italic text-slate-800 mt-1 font-semibold">"{report.feedback}"</p>
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
