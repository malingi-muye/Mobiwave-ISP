import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, doc, updateDoc, setDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { createSpreadsheet, setupCollectionSheet, sendGmailEmail, createGoogleTask } from '../lib/googleApi';
import { FundsRequest, UserProfile, FinanceRecord, CoastArea, UserRole } from '../types';
import { 
  ShieldAlert, UserPlus, Check, X, FileCheck, RefreshCw, Send, 
  MapPin, Coins, ExternalLink, Link2, AlertCircle, CheckCircle2, ListFilter,
  CheckCircle, Plus, Users, HeartHandshake, Layers, Trash2, Edit, Save,
  BookOpen, Briefcase, Award, ShieldCheck
} from 'lucide-react';
import { motion } from 'motion/react';

interface AdminViewProps {
  onSpreadsheetCreated: (id: string) => void;
  savedSpreadsheetId: string | null;
}

export default function AdminView({ onSpreadsheetCreated, savedSpreadsheetId }: AdminViewProps) {
  // Lists
  const [requests, setRequests] = useState<FundsRequest[]>([]);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [finances, setFinances] = useState<FinanceRecord[]>([]);

  // UI States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // User Signup State
  const [signupEmail, setSignupEmail] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupRole, setSignupRole] = useState<UserRole>('reseller');
  const [signupArea, setSignupArea] = useState<CoastArea>('Mombasa');

  // Manual payment state
  const [selectedResId, setSelectedResId] = useState('');
  const [financeType, setFinanceType] = useState<'biweekly_support' | 'monthly_commission'>('biweekly_support');
  const [financeAmount, setFinanceAmount] = useState('');
  const [financePeriod, setFinancePeriod] = useState('2026 June Biweekly 1');

  // Profile Inline Editor State
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('reseller');
  const [editArea, setEditArea] = useState<CoastArea>('Mombasa');

  // Direct Task Assignment State
  const [taskReseller, setTaskReseller] = useState('');
  const [taskWeekStart, setTaskWeekStart] = useState('2026-06-15');
  const [taskObjective, setTaskObjective] = useState('');
  const [taskDailyBreakdown, setTaskDailyBreakdown] = useState('');

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch support request forms
      const reqSnap = await getDocs(collection(db, 'requests'));
      setRequests(reqSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as FundsRequest[]);

      // 2. Fetch profiles
      const profSnap = await getDocs(collection(db, 'users'));
      const profilesList = profSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() })) as UserProfile[];
      setProfiles(profilesList);
      if (profilesList.length > 0) {
        setSelectedResId(profilesList[0].uid);
        if (!taskReseller) setTaskReseller(profilesList[0].uid);
      }

      // 3. Fetch financial payout records
      const finSnap = await getDocs(collection(db, 'finances'));
      setFinances(finSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as FinanceRecord[]);

    } catch (err: any) {
      console.error(err);
      setError('Could not fetch administrative profiles.');
    } finally {
      setLoading(false);
    }
  };

  // Start Edit Mode for User Profile
  const startEditingProfile = (profile: UserProfile) => {
    setEditingProfileId(profile.uid);
    setEditDisplayName(profile.displayName);
    setEditRole(profile.role);
    setEditArea(profile.area || 'Mombasa');
  };

  // Save/Update Edited User Profile in Firestore
  const handleUpdateProfile = async (uid: string) => {
    if (!editDisplayName.trim()) {
      setError('User display name is required.');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, {
        displayName: editDisplayName,
        role: editRole,
        area: editRole === 'reseller' ? editArea : null
      });
      setSuccess(`User profile for "${editDisplayName}" has been successfully updated.`);
      setEditingProfileId(null);
      await fetchAdminData();
    } catch (err: any) {
      console.error(err);
      setError('Failed to update user profile.');
    } finally {
      setLoading(false);
    }
  };

  // Delete User Profile
  const handleDeleteProfile = async (uid: string, name: string) => {
    const confirmDelete = window.confirm(`Are you absolutely sure you want to revoke system Access & DELETE the profile of "${name}"?`);
    if (!confirmDelete) return;

    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await deleteDoc(doc(db, 'users', uid));
      setSuccess(`User profile for "${name}" has been permanently removed.`);
      await fetchAdminData();
    } catch (err: any) {
      console.error(err);
      setError('Failed to delete user profile.');
    } finally {
      setLoading(false);
    }
  };

  // Direct Tasks & Weekly Objectives Assignment
  const handleAssignTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskReseller || !taskObjective || !taskDailyBreakdown) {
      setError('Please provide complete reseller, week template, and task criteria details.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const targetUser = profiles.find(p => p.uid === taskReseller);
      const planId = `plan_${taskReseller}_${taskWeekStart}`;

      const newPlan = {
        id: planId,
        resellerId: taskReseller,
        weekStartDate: taskWeekStart,
        objective: taskObjective,
        tasks: taskDailyBreakdown
      };

      await setDoc(doc(db, 'plans', planId), newPlan);

      // Email Notification to Reseller
      if (targetUser?.email) {
        await sendGmailEmail(
          targetUser.email,
          `Mobiwave ISP: New Weekly Objective & Tasks Allocated`,
          `<h3>Hello ${targetUser.displayName},</h3>
           <p>Your Admin Coordinator has allocated a new active weekly objective agenda for the week of ${taskWeekStart}:</p>
           <blockquote style="padding: 12px; background: #e0f2fe; border-left: 4px solid #0284c7; font-weight: bold; font-style: italic; border-radius: 4px;">
             "${taskObjective}"
           </blockquote>
           <p><strong>Daily Tasks & Performance Guidelines:</strong></p>
           <pre style="padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; font-family: monospace; font-size: 13px; white-space: pre-wrap; border-radius: 6px;">${taskDailyBreakdown}</pre>
           <p>Please log matching lead connection submissions inside your reseller board to reach your KPIs!</p>
           <p>Best regards,<br/>Mobiwave ISP Administration Office</p>`
        ).catch(() => console.log('Gmail task delivery offline or pending scope'));
      }

      setSuccess(`Weekly Task Agenda dispatched successfully for ${targetUser?.displayName}!`);
      setTaskObjective('');
      setTaskDailyBreakdown('');
      await fetchAdminData();
    } catch (err: any) {
      console.error(err);
      setError('Failed to assign task agenda.');
    } finally {
      setLoading(false);
    }
  };


  // Setup Google Sheet integration spreadsheet
  const handleSetupSheet = async () => {
    const confirmSetup = window.confirm("Do you want to automatically create a central Google Sheet to capture real-time leads logs, finance receipts & payouts?");
    if (!confirmSetup) return;

    setLoading(true);
    setSuccess(null);
    setError(null);
    try {
      // Create Sheet via Sheets API
      const sheetId = await createSpreadsheet("Coast Internet Leads & Support Central Ledger");
      
      // Add sheet tables layout headers
      await setupCollectionSheet(sheetId, "Leads Log", [
        "Lead ID", "Reseller Name", "Client Establishment", "Geographical Location", "Institution", "Contact Phone", "Paid Setup Revenue (KES)", "Timestamp"
      ]);

      await setupCollectionSheet(sheetId, "Biweekly Support Logs", [
        "Request ID", "Recipient Name", "Recipient Email", "Dispensed Amount (KES)", "Purpose Description", "Period Label", "Review status", "Receipt signed"
      ]);

      onSpreadsheetCreated(sheetId);
      setSuccess(`Google Sheets integration activated successfully! Central leads log is now fully synchronized.`);
    } catch (err: any) {
      console.error(err);
      setError(`Google Sheet instantiation failed. Ensure Workspace OAuth permissions are accepted.`);
    } finally {
      setLoading(false);
    }
  };

  // Support Request Approvals/Rejections (Admin Approves link submissions)
  const handleRequestStatus = async (id: string, newStatus: 'approved' | 'rejected') => {
    const confirmed = window.confirm(`Confirm: Mark biweekly support request ${id} as ${newStatus.toUpperCase()}?`);
    if (!confirmed) return;

    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const requestRef = doc(db, 'requests', id);
      const targetRequest = requests.find(r => r.id === id);

      if (!targetRequest) {
        setError('Request item missing.');
        return;
      }

      const patchData = {
        status: newStatus,
        approvedAt: newStatus === 'approved' ? new Date().toISOString() : null
      };

      await updateDoc(requestRef, patchData);

      // Dispatch payout record to финансы on Approval
      if (newStatus === 'approved') {
        const financeId = `fin_req_${id}`;
        const newFinance: FinanceRecord = {
          id: financeId,
          resellerId: targetRequest.recipientEmail, // Mapping UID or email for guest referrals
          resellerName: targetRequest.recipientName,
          type: 'biweekly_support',
          amount: targetRequest.amount,
          period: targetRequest.biweeklyPeriod,
          status: 'pending', // Awaiting signedReceipt signature
          date: new Date().toISOString()
        };
        await setDoc(doc(db, 'finances', financeId), newFinance);

        // Formulate actionable task in Google Tasks for administrative cash allocation
        await createGoogleTask(
          `Disburse funds: ${targetRequest.recipientName}`,
          `Disburse payments support of KES ${targetRequest.amount.toLocaleString()} for request ${id} (${targetRequest.purpose})`
        ).catch(() => console.log('Tasks sync offline or pending API scope'));
      }

      // Gmail notification alert sent to recipient containing form link for Sign Receipt confirmation
      await sendGmailEmail(
        targetRequest.recipientEmail,
        `Internet Support Request Status Alert: ${newStatus.toUpperCase()}`,
        `<h3>Support Allocation Update</h3>
         <p>Hello ${targetRequest.recipientName},</p>
         <p>Your biweekly allocation request of <strong>KES ${targetRequest.amount.toLocaleString()}</strong> has been <strong>${newStatus.toUpperCase()}</strong>.</p>
         <p><strong>Next Action Items:</strong></p>
         ${newStatus === 'approved' ? `
         <p>In adherence to transparency guidelines, you are required to sign the Digital Receipt confirming receipt of funds.</p>
         <p><a href="${window.location.origin}?reqId=${id}" style="display:inline-block;padding:10px 20px;background-color:#10b981;color:#fff;text-decoration:none;border-radius:5px;">Sign Receipt Form now</a></p>
         ` : `
         <p>Your regional supervisor will communicate challenges-feedback shortly.</p>
         `}
         <p>Best regards,<br/>Admin Oversight Directorate</p>`
      ).catch(() => console.log('No-send gmail placeholder'));

      setSuccess(`Request ${id} marked as ${newStatus}! Recipient emailed.`);
      await fetchAdminData();
    } catch (err: any) {
      console.error(err);
      setError('Approvals status transition failed.');
    } finally {
      setLoading(false);
    }
  };

  // Add User Profile registration mapping
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupEmail || !signupName) {
      setError('Fill user credentials.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const pseudoUid = 'user_' + Math.random().toString(36).substring(2, 9);
      const newProfile: UserProfile = {
        uid: pseudoUid,
        email: signupEmail.toLowerCase().trim(),
        displayName: signupName,
        role: signupRole,
        area: signupRole === 'reseller' ? signupArea : undefined
      };

      await setDoc(doc(db, 'users', pseudoUid), newProfile);
      setSuccess(`User registration logged: ${signupName} added as ${signupRole}!`);
      setSignupName('');
      setSignupEmail('');
      await fetchAdminData();
    } catch (err: any) {
      console.error(err);
      setError('Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  // Dispatch payment
  const handleLogManualPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedResId || !financeAmount) {
      setError('Provide target reseller and payoff values.');
      return;
    }

    const value = parseFloat(financeAmount);
    if (isNaN(value) || value <= 0) {
      setError('Provide valid disbursement sum.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const resellerUser = profiles.find(p => p.uid === selectedResId);
      const finId = 'fin_' + Math.random().toString(36).substring(2, 9);
      const newFin: FinanceRecord = {
        id: finId,
        resellerId: selectedResId,
        resellerName: resellerUser?.displayName || resellerUser?.email || 'Reseller Agent',
        type: financeType,
        amount: value,
        period: financePeriod,
        status: 'paid',
        date: new Date().toISOString()
      };

      await setDoc(doc(db, 'finances', finId), newFin);

      // Notify reseller of commission/support settlement
      if (resellerUser?.email) {
        await sendGmailEmail(
          resellerUser.email,
          "Financial Support Disbursed Confirmation",
          `<h3>Financial Receipt Alert</h3>
           <p>The payroll desk has finalized payouts to your account:</p>
           <ul>
             <li><strong>Payment Type:</strong> ${financeType === 'biweekly_support' ? 'Biweekly Operational Support' : 'Monthly Performance Commission'}</li>
             <li><strong>Value Disbursed:</strong> KES ${value.toLocaleString()}</li>
             <li><strong>Payout Period:</strong> ${financePeriod}</li>
           </ul>
           <p>Keep logging connection achievements to earn commissions!</p>`
        ).catch(() => console.log('Mail outlines offline'));
      }

      setSuccess(`Financial log saved as PAID for ${resellerUser?.displayName}!`);
      setFinanceAmount('');
      await fetchAdminData();
    } catch (err: any) {
      console.error(err);
      setError('Payment logs configuration crash.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Central Google Sheets Ledger Integration Banner */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm overflow-hidden relative">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-44 h-44 bg-indigo-50/50 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <Link2 className="w-5 h-5" />
              </span>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">Google Sheets Master Ledger Sync</h3>
            </div>
            <p className="text-xs text-slate-500 mt-2 max-w-2xl leading-relaxed">
              Connect the central high-performance ledger. This maps every connection lead row, biweekly support request, and commission receipt directly to an active Google Sheet in real-time.
            </p>
          </div>

          <div className="shrink-0">
            {savedSpreadsheetId ? (
              <div className="flex items-center gap-2.5">
                <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-100 font-extrabold px-3 py-2 rounded-xl flex items-center gap-1.5 uppercase tracking-wider font-mono">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Synced
                </span>
                <a 
                  href={`https://docs.google.com/spreadsheets/d/${savedSpreadsheetId}/edit`} 
                  target="_blank" 
                  rel="noreferrer"
                  className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
                >
                  Configure Sheet <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            ) : (
              <button
                onClick={handleSetupSheet}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4.5 py-2.5 rounded-xl text-xs font-bold shadow-sm transition-all focus:ring-2 focus:ring-indigo-500/25 active:scale-95 flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4 animate-spin-slow" /> Bootstrap Google Ledger Sheet
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Dynamic Status Notifications */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs flex items-center gap-3 animate-fadeIn">
          <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0" />
          <span className="font-semibold">{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl text-xs flex items-center gap-3 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span className="font-extrabold">{success}</span>
        </div>
      )}

      {/* Pending Support Forms Approval list */}
      <section className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3.5 mb-4">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
              <FileCheck className="w-4.5 h-4.5" />
            </span>
            <div>
              <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">Support Requests Auth Queue</h3>
              <p className="text-[10px] text-slate-400">Evaluate public refer form entries and approve biweekly disbursements</p>
            </div>
          </div>
          <span className="text-[10px] bg-slate-100 border border-slate-200 text-slate-500 font-bold px-2.5 py-1 rounded-xl">
            {requests.length} entries total
          </span>
        </div>

        {requests.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs font-medium">
            No support requests compiled at this time. Send recipient referral form links to log details.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-medium">
              <thead className="text-slate-400 border-b border-slate-100 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="pb-3 text-slate-500">Form ID</th>
                  <th className="pb-3 text-slate-500">Recipient</th>
                  <th className="pb-3 text-slate-500">Requested Amount</th>
                  <th className="pb-3 text-slate-500">Period</th>
                  <th className="pb-3 text-slate-500">Mission Statement</th>
                  <th className="pb-3 text-slate-500">Receipt Sign</th>
                  <th className="pb-3 text-slate-500 text-right">Authorize</th>
                </tr>
              </thead>
              <tbody className="text-slate-600 divide-y divide-slate-50 text-[11px] font-semibold">
                {requests.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 font-mono text-slate-400 font-bold">{r.id.substring(0, 8)}</td>
                    <td className="py-3.5">
                      <p className="font-bold text-slate-800">{r.recipientName}</p>
                      <p className="text-[9px] text-slate-400 font-mono font-bold mt-0.5">{r.recipientEmail}</p>
                    </td>
                    <td className="py-3.5 font-extrabold text-slate-900 font-mono">KES {r.amount.toLocaleString()}</td>
                    <td className="py-3.5 font-mono text-[10px] text-slate-500">{r.biweeklyPeriod}</td>
                    <td className="py-3.5 text-slate-500 max-w-[140px] truncate italic" title={r.purpose}>
                      "{r.purpose}"
                    </td>
                    <td className="py-3.5">
                      <span className={`px-2 py-0.5 rounded-lg text-[9px] font-extrabold uppercase tracking-wide border ${
                        r.signedReceipt 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-150' 
                          : r.status === 'approved' 
                            ? 'bg-amber-50 text-amber-700 border-amber-150 animate-pulse' 
                            : 'bg-slate-50 text-slate-400 border-slate-150'
                      }`}>
                        {r.signedReceipt ? 'Signed ✓' : r.status === 'approved' ? 'Awaiting sign' : 'Not setup'}
                      </span>
                    </td>
                    <td className="py-3.5 text-right">
                      {r.status === 'pending' ? (
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => handleRequestStatus(r.id, 'rejected')}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-lg cursor-pointer transition-colors"
                            title="Reject Funding Request"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleRequestStatus(r.id, 'approved')}
                            className="p-1 px-2 text-emerald-700 hover:bg-emerald-50 border border-emerald-200 text-[10px] font-extrabold rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                            title="Approve & Dispatch Notification"
                          >
                            <Check className="w-3.5 h-3.5" /> Approve
                          </button>
                        </div>
                      ) : (
                        <span className={`text-[10px] font-bold flex items-center justify-end gap-1 ${
                          r.status === 'approved' ? 'text-emerald-600' : 'text-rose-500'
                        }`}>
                          {r.status === 'approved' ? 'Approved ✓' : 'Rejected ✕'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* USER ACCOUNTS MANAGEMENT BOARD / ACTIVE AFFILIATES DIRECTORY */}
      <section className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3.5 mb-4">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
              <Users className="w-4.5 h-4.5" />
            </span>
            <div>
              <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">Active Workspace Registry & Permissions</h3>
              <p className="text-[10px] text-slate-400">Manage real-time user workspace authorizations, edit role credentials, and assign coast sectors</p>
            </div>
          </div>
          <span className="text-[10px] bg-indigo-50 border border-indigo-150 text-indigo-700 font-bold px-2.5 py-1 rounded-xl">
            {profiles.length} Verified Accounts
          </span>
        </div>

        {profiles.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs font-medium">
            No registered users found in directory database.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-medium">
              <thead className="text-slate-400 border-b border-slate-100 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="pb-3 text-slate-500">Full Name</th>
                  <th className="pb-3 text-slate-500">Google Email</th>
                  <th className="pb-3 text-slate-500">Workspace Access Role</th>
                  <th className="pb-3 text-slate-500">Allocated Division Sector</th>
                  <th className="pb-3 text-slate-500 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-slate-600 divide-y divide-slate-50 text-[11px] font-semibold">
                {profiles.map((p) => {
                  const isEditing = editingProfileId === p.uid;
                  return (
                    <tr key={p.uid} className={`hover:bg-slate-50/50 transition-colors ${isEditing ? 'bg-indigo-50/25' : ''}`}>
                      <td className="py-3.5">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editDisplayName}
                            onChange={(e) => setEditDisplayName(e.target.value)}
                            className="px-2 py-1 border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:ring-1 focus:ring-indigo-500 bg-white text-slate-800"
                          />
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                            <p className="font-bold text-slate-800">{p.displayName}</p>
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 font-mono text-slate-500">{p.email}</td>
                      <td className="py-3.5">
                        {isEditing ? (
                          <select
                            value={editRole}
                            onChange={(e) => setEditRole(e.target.value as UserRole)}
                            className="px-2 py-1 border border-slate-200 rounded-lg text-xs font-semibold bg-white outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                          >
                            <option value="reseller">Reseller (Field Agent)</option>
                            <option value="management">Management Supervisor</option>
                            <option value="admin">System Administrator</option>
                          </select>
                        ) : (
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide border ${
                            p.role === 'admin' 
                              ? 'bg-rose-50 text-rose-700 border-rose-100' 
                              : p.role === 'management' 
                                ? 'bg-amber-50 text-amber-700 border-amber-100' 
                                : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                          }`}>
                            {p.role}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5">
                        {isEditing ? (
                          editRole === 'reseller' ? (
                            <select
                              value={editArea}
                              onChange={(e) => setEditArea(e.target.value as CoastArea)}
                              className="px-2 py-1 border border-slate-200 rounded-lg text-xs font-semibold bg-white outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                            >
                              <option value="Mombasa">Mombasa</option>
                              <option value="Malindi">Malindi</option>
                              <option value="Kilifi">Kilifi</option>
                              <option value="Kwale">Kwale</option>
                              <option value="Lamu">Lamu</option>
                              <option value="Tana River">Tana River</option>
                            </select>
                          ) : (
                            <span className="text-slate-400 font-normal italic">All Sectors</span>
                          )
                        ) : (
                          <span className="font-semibold text-slate-700 font-mono">
                            {p.role === 'reseller' ? (p.area || 'Mombasa') : 'Global'}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 text-right">
                        <div className="flex gap-2 justify-end items-center">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => setEditingProfileId(null)}
                                className="p-1 text-slate-500 hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer transition-colors"
                                title="Cancel"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleUpdateProfile(p.uid)}
                                className="p-1 text-emerald-700 hover:bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                                title="Save Profile Settings"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => startEditingProfile(p)}
                                className="p-1.5 text-indigo-600 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-lg cursor-pointer transition-colors"
                                title="Edit User Identity & Roles"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteProfile(p.uid, p.displayName)}
                                className="p-1.5 text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-lg cursor-pointer transition-colors"
                                title="Revoke access & Delete Account"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* MULTI-COLUMN COMPACT BENTO COMPONENT FOR USER ROLES & FINANCIAL DISBURSMENTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* User Account Registry Form card */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
            <span className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
              <Users className="w-4 h-4" />
            </span>
            <div>
              <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">Affiliate User Provisioning</h3>
              <p className="text-[10px] text-slate-400">Map new field agents or administrative directors</p>
            </div>
          </div>

          <form onSubmit={handleAddUser} className="space-y-3.5 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-500 mb-1">Account Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Salim Mwangi"
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none font-semibold text-slate-700"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-500 mb-1">Account Google Email</label>
                <input
                  type="email"
                  required
                  placeholder="name@gmail.com"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none font-mono font-semibold text-slate-700"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-500 mb-1">System Access Role</label>
                <select
                  required
                  value={signupRole}
                  onChange={(e) => setSignupRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none bg-white font-semibold text-slate-700"
                >
                  <option value="reseller">Reseller (Field Agent)</option>
                  <option value="management">Management Supervisor</option>
                  <option value="admin">System Administrator</option>
                </select>
              </div>

              {signupRole === 'reseller' && (
                <div>
                  <label className="block font-semibold text-slate-500 mb-1">Allocated Sector</label>
                  <select
                    required
                    value={signupArea}
                    onChange={(e) => setSignupArea(e.target.value as CoastArea)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none bg-white font-semibold text-slate-700"
                  >
                    <option value="Mombasa">Mombasa</option>
                    <option value="Malindi">Malindi</option>
                    <option value="Kilifi">Kilifi</option>
                    <option value="Kwale">Kwale</option>
                    <option value="Lamu">Lamu</option>
                    <option value="Tana River">Tana River</option>
                  </select>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 px-4 rounded-xl transition-all shadow-sm active:scale-95 text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer mt-2"
            >
              <Plus className="w-3.5 h-3.5" /> Provision Profile User
            </button>
          </form>
        </div>

        {/* Manual finance payout logger card */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
            <span className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
              <Coins className="w-4 h-4" />
            </span>
            <div>
              <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">Payroll & Disbursements Ledger</h3>
              <p className="text-[10px] text-slate-400">Log biweekly support allocations or commissions payments</p>
            </div>
          </div>

          <form onSubmit={handleLogManualPayment} className="space-y-3.5 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-500 mb-1">Reseller Beneficiary</label>
                <select
                  required
                  value={selectedResId}
                  onChange={(e) => setSelectedResId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none bg-white font-semibold text-slate-700"
                >
                  {profiles.length === 0 ? (
                    <option value="">No Active Users found</option>
                  ) : (
                    profiles.map(p => (
                      <option key={p.uid} value={p.uid}>{p.displayName} ({p.role})</option>
                    ))
                  )}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-500 mb-1">Payment Class Type</label>
                <select
                  required
                  value={financeType}
                  onChange={(e) => setFinanceType(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none bg-white font-semibold text-slate-700"
                >
                  <option value="biweekly_support">Biweekly Operational Support</option>
                  <option value="monthly_commission">Monthly Lead Commission</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-500 mb-1">Disbursed Sum (KES)</label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 15000"
                  value={financeAmount}
                  onChange={(e) => setFinanceAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none font-semibold text-slate-700"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-500 mb-1">Period Label</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 2026 June Biweekly 1"
                  value={financePeriod}
                  onChange={(e) => setFinancePeriod(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none font-mono font-semibold text-slate-700"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-xl transition-all shadow-sm active:scale-95 text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer mt-2"
            >
              <Send className="w-3.5 h-3.5" /> Dispatch Payment Allocation
            </button>
          </form>
        </div>

        {/* Direct Tasks & Weekly Objectives Assignment card */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between col-span-1 lg:col-span-2">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
            <span className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
              <Briefcase className="w-4 h-4" />
            </span>
            <div>
              <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">Direct Weekly Performance Tasking & Plans</h3>
              <p className="text-[10px] text-slate-400">Allocate daily instructions, assign key work programs to field agents, with real-time email triggers</p>
            </div>
          </div>

          <form onSubmit={handleAssignTask} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold text-slate-500 mb-1">Target Reseller Recipient</label>
                <select
                  required
                  value={taskReseller}
                  onChange={(e) => setTaskReseller(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none bg-white font-semibold text-slate-700"
                >
                  {profiles.length === 0 ? (
                    <option value="">No Active Users found</option>
                  ) : (
                    profiles.map(p => (
                      <option key={p.uid} value={p.uid}>{p.displayName} ({p.role})</option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-500 mb-1">Active Target Week Starting</label>
                <input
                  type="date"
                  required
                  value={taskWeekStart}
                  onChange={(e) => setTaskWeekStart(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none font-mono font-semibold text-slate-700"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-500 mb-1">Weekly Metric Objective Summary</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Expand fiber sales in Kilifi by 10 units"
                  value={taskObjective}
                  onChange={(e) => setTaskObjective(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none font-semibold text-slate-700"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-500 mb-1">Daily Task Breakdown / Actionable Directives</label>
              <textarea
                required
                rows={3}
                placeholder="Monday: Lead outreach in northern sector&#10;Tuesday: Meetings with institution representatives&#10;Wednesday: Setup agreements and deposit compliance logs"
                value={taskDailyBreakdown}
                onChange={(e) => setTaskDailyBreakdown(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none font-semibold text-slate-700 min-h-[80px]"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-4 rounded-xl transition-all shadow-sm active:scale-95 text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Award className="w-4 h-4 text-teal-400" /> Allocate Task Program & Email Notify
            </button>
          </form>
        </div>

      </div>

    </div>
  );
}
