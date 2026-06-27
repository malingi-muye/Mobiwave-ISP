import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, doc, updateDoc, setDoc, deleteDoc, query, where } from 'firebase/firestore';
import { createSpreadsheet, setupCollectionSheet, sendGmailEmail, createGoogleTask } from '../lib/googleApi';
import { FundsRequest, UserProfile, FinanceRecord, CoastArea, UserRole } from '../types';
import { 
  ShieldAlert, UserPlus, Check, X, FileCheck, RefreshCw, Send, 
  MapPin, Coins, ExternalLink, Link2, AlertCircle, CheckCircle2,
  Plus, Users, Trash2, Edit, Save, Award, Briefcase, LayoutGrid, Search, MoreHorizontal, GripVertical
} from 'lucide-react';
import { Button } from './ui/Button';
import { Card, CardHeader, CardTitle, CardDescription } from './ui/Card';
import { Badge } from './ui/Badge';
import { Input, Select } from './ui/Input';

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
  const [signupPassword, setSignupPassword] = useState(() => 'MBW-' + Math.floor(1000 + Math.random() * 9000));

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
    try {
      const reqSnap = await getDocs(collection(db, 'requests'));
      setRequests(reqSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as FundsRequest[]);

      const profSnap = await getDocs(collection(db, 'users'));
      const profilesList = profSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() })) as UserProfile[];
      setProfiles(profilesList);
      if (profilesList.length > 0) {
        setSelectedResId(profilesList[0].uid);
        if (!taskReseller) setTaskReseller(profilesList[0].uid);
      }

      const finSnap = await getDocs(collection(db, 'finances'));
      setFinances(finSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as FinanceRecord[]);
    } catch (err) {
      setError('Could not fetch data.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (uid: string) => {
    setLoading(true);
    setError(null);
    try {
      await updateDoc(doc(db, 'users', uid), {
        displayName: editDisplayName,
        role: editRole,
        area: editRole === 'reseller' ? editArea : null
      });
      setSuccess(`Profile updated!`);
      setEditingProfileId(null);
      await fetchAdminData();
    } catch (err) {
      console.error('Update profile error:', err);
      setError('Update failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProfile = async (uid: string, name: string) => {
    if (!window.confirm(`Delete profile of "${name}"?`)) return;
    setLoading(true);
    setError(null);
    try {
      await deleteDoc(doc(db, 'users', uid));
      setSuccess(`Permanently removed.`);
      await fetchAdminData();
    } catch (err) {
      console.error('Delete profile error:', err);
      setError('Delete failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const resellerUser = profiles.find(p => p.uid === taskReseller);
      const planId = `plan_${taskReseller}_${taskWeekStart}`;
      await setDoc(doc(db, 'plans', planId), {
        id: planId,
        resellerId: taskReseller,
        weekStartDate: taskWeekStart,
        objective: taskObjective,
        tasks: taskDailyBreakdown
      });

      // Restore Google Task sync
      await createGoogleTask(
        `Work Plan: ${taskWeekStart}`,
        `Objective: ${taskObjective}\nTasks: ${taskDailyBreakdown}`
      ).catch((e) => console.log('Google Task sync offline', e));

      // Restore Email notification
      if (resellerUser?.email) {
        await sendGmailEmail(
          resellerUser.email,
          "New Work Plan Assigned",
          `<h3>Hello ${resellerUser.displayName},</h3>
           <p>A new work plan has been assigned to you for the week starting <strong>${taskWeekStart}</strong>.</p>
           <p><strong>Objective:</strong> ${taskObjective}</p>
           <p>Please log in to the portal to view your daily breakdown.</p>`
        ).catch((e) => console.log('Task email deferred', e));
      }

      setSuccess(`Task dispatched and synced!`);
      setTaskObjective('');
      setTaskDailyBreakdown('');
      await fetchAdminData();
    } catch (err) {
      console.error('Task assignment error:', err);
      setError('Task assignment failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogManualPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const resellerUser = profiles.find(p => p.uid === selectedResId);
      const finId = 'fin_' + Math.random().toString(36).substring(2, 9);
      await setDoc(doc(db, 'finances', finId), {
        id: finId, resellerId: selectedResId, resellerName: resellerUser?.displayName || 'Agent',
        type: financeType, amount: parseFloat(financeAmount), period: financePeriod, status: 'paid', date: new Date().toISOString()
      });
      setSuccess(`Payment saved!`);
      setFinanceAmount(''); await fetchAdminData();
    } catch (err) {
      setError('Payment log failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSetupSheet = async () => {
    setLoading(true);
    try {
      const sheetId = await createSpreadsheet("Coast Internet Leads Central Ledger");
      await setupCollectionSheet(sheetId, "Leads Log", ["ID", "Name", "Client", "Location", "Type", "Phone", "Revenue", "Time"]);
      onSpreadsheetCreated(sheetId);
      setSuccess(`Ledger Sync Active!`);
    } catch (err) {
      setError(`Setup failed.`);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestStatus = async (id: string, newStatus: 'approved' | 'rejected') => {
    setLoading(true);
    try {
      const requestRef = doc(db, 'requests', id);
      const targetRequest = requests.find(r => r.id === id);
      if (!targetRequest) return;

      await updateDoc(requestRef, { status: newStatus, approvedAt: newStatus === 'approved' ? new Date().toISOString() : null });

      if (newStatus === 'approved') {
        const financeId = `fin_req_${id}`;
        await setDoc(doc(db, 'finances', financeId), {
          id: financeId, resellerId: targetRequest.recipientEmail, resellerName: targetRequest.recipientName,
          type: 'biweekly_support', amount: targetRequest.amount, period: targetRequest.biweeklyPeriod, status: 'pending', date: new Date().toISOString()
        });

        // Restore Email notification
        await sendGmailEmail(
          targetRequest.recipientEmail,
          "Support Request Approved: Sign Receipt",
          `<h3>Hello ${targetRequest.recipientName},</h3>
           <p>Your support request for <strong>KES ${targetRequest.amount.toLocaleString()}</strong> has been approved.</p>
           <p>Please log in to your portal or use the public link to sign the disbursement receipt.</p>`
        ).catch(() => {});
      }
      setSuccess(`Request ${newStatus}!`);
      await fetchAdminData();
    } catch (err) {
      setError('Update failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const pseudoUid = 'user_' + Math.random().toString(36).substring(2, 9);
      await setDoc(doc(db, 'users', pseudoUid), {
        uid: pseudoUid, email: signupEmail.toLowerCase().trim(), displayName: signupName,
        role: signupRole, area: signupRole === 'reseller' ? signupArea : null, password: signupPassword
      });

      // Restore Welcome email
      await sendGmailEmail(
        signupEmail,
        "Welcome to Mobiwave ISP Portal: Your Account Passcode",
        `<h3>Welcome ${signupName}!</h3>
         <p>You have been registered as a <strong>${signupRole}</strong> for the <strong>${signupArea}</strong> sector.</p>
         <p>Use the following details to log in via the Bypass tab:</p>
         <ul>
           <li>Email: ${signupEmail}</li>
           <li>Passcode: <strong>${signupPassword}</strong></li>
         </ul>
         <p>Access Portal: ${window.location.origin}</p>`
      ).catch(() => console.log('Gmail notification send offline or pending configuration'));

      setSuccess(`User Registered!`);
      setSignupName(''); setSignupEmail(''); setSignupPassword('MBW-' + Math.floor(1000 + Math.random() * 9000));
      await fetchAdminData();
    } catch (err) {
      setError('Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Notifications */}
      {error && <div className="p-4 one-glass border-one-red/20 bg-one-red/5 text-one-red rounded-2xl text-xs font-bold flex items-center gap-3 animate-one-fade-in"><AlertCircle size={18}/>{error}</div>}
      {success && <div className="p-4 one-glass border-one-green/20 bg-one-green/5 text-one-green rounded-2xl text-xs font-bold flex items-center gap-3 animate-one-fade-in"><CheckCircle2 size={18}/>{success}</div>}

      {/* Ledger Card */}
      <Card className="flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative group">
        <div className="absolute right-0 top-0 w-64 h-64 bg-one-blue/5 rounded-full blur-[80px] -translate-y-32 translate-x-32 group-hover:bg-one-blue/10 transition-colors" />
        <div className="flex items-center gap-6 relative z-10">
          <div className="w-16 h-16 rounded-[24px] bg-one-blue text-white flex items-center justify-center shadow-xl shadow-one-blue/20">
            <Link2 size={32}/>
          </div>
          <div>
            <CardTitle className="text-lg">Master Ledger Sync</CardTitle>
            <CardDescription className="max-w-md text-sm">Connect real-time lead logs, finance receipts, and payroll payouts to a central Google Sheet.</CardDescription>
          </div>
        </div>
        <div className="relative z-10">
          {savedSpreadsheetId ? (
            <div className="flex items-center gap-3">
              <Badge variant="green" className="py-2 px-4">Synced</Badge>
              <Button onClick={() => window.open(`https://docs.google.com/spreadsheets/d/${savedSpreadsheetId}/edit`, '_blank')}>View Sheet <ExternalLink size={14} className="ml-2"/></Button>
            </div>
          ) : (
            <Button onClick={handleSetupSheet} disabled={loading} className="h-14 px-8">Bootstrap Ledger</Button>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Support Queue */}
        <Card className="lg:col-span-7 p-0">
          <CardHeader className="p-8 border-b border-slate-50">
            <div>
              <CardTitle>Auth Queue</CardTitle>
              <CardDescription>Public referral form entries pending review</CardDescription>
            </div>
            <Badge variant="purple">{requests.length} Entries</Badge>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="px-8 py-4">Recipient</th>
                  <th className="px-4 py-4 text-center">Amount</th>
                  <th className="px-4 py-4">Status</th>
                  <th className="px-8 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {requests.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50/30 group">
                    <td className="px-8 py-5">
                      <p className="text-sm font-bold text-slate-900">{r.recipientName}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">{r.recipientEmail}</p>
                    </td>
                    <td className="px-4 py-5 text-center font-mono font-bold text-xs">KES {r.amount.toLocaleString()}</td>
                    <td className="px-4 py-5">
                      <Badge variant={r.status === 'approved' ? 'green' : r.status === 'pending' ? 'orange' : 'red'}>{r.status}</Badge>
                    </td>
                    <td className="px-8 py-5 text-right flex justify-end gap-2">
                      {r.status === 'pending' ? (
                        <>
                          <Button size="sm" variant="success" onClick={() => handleRequestStatus(r.id, 'approved')}><Check size={14}/></Button>
                          <Button size="sm" variant="danger" onClick={() => handleRequestStatus(r.id, 'rejected')}><X size={14}/></Button>
                        </>
                      ) : (
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                          {r.signedReceipt ? <Badge variant="green">Signed ✓</Badge> : <Badge>Processed</Badge>}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* User Provisioning */}
        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle>Provision User</CardTitle>
            <div className="p-2 bg-one-indigo/10 text-one-indigo rounded-xl"><UserPlus size={20}/></div>
          </CardHeader>
          <form onSubmit={handleAddUser} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Full Name" value={signupName} onChange={(e) => setSignupName(e.target.value)} required placeholder="Salim Mwangi" />
              <Input label="Email" type="email" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} required placeholder="name@gmail.com" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Select label="Role" value={signupRole} onChange={(e) => setSignupRole(e.target.value as any)}>
                <option value="reseller">Field Agent</option>
                <option value="management">Oversight</option>
                <option value="admin">System Admin</option>
              </Select>
              {signupRole === 'reseller' && (
                <Select label="Sector" value={signupArea} onChange={(e) => setSignupArea(e.target.value as any)}>
                  <option>Mombasa</option><option>Malindi</option><option>Kilifi</option><option>Kwale</option>
                </Select>
              )}
            </div>
            <div className="flex gap-2">
               <Input label="Passcode" value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} required className="font-mono text-one-indigo bg-one-indigo/5" />
               <Button type="button" variant="ghost" onClick={()=>setSignupPassword('MBW-'+Math.floor(1000+Math.random()*9000))} className="mt-5">Regen</Button>
            </div>
            <Button type="submit" variant="secondary" className="w-full h-12">Provision Profile</Button>
          </form>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Payroll */}
        <Card>
          <CardHeader>
            <CardTitle>Payroll Ledger</CardTitle>
            <div className="p-2 bg-one-green/10 text-one-green rounded-xl"><Coins size={20}/></div>
          </CardHeader>
          <form onSubmit={handleLogManualPayment} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Select label="Beneficiary" value={selectedResId} onChange={(e) => setSelectedResId(e.target.value)}>
                {profiles.map(p => <option key={p.uid} value={p.uid}>{p.displayName}</option>)}
              </Select>
              <Select label="Type" value={financeType} onChange={(e) => setFinanceType(e.target.value as any)}>
                <option value="biweekly_support">Support</option>
                <option value="monthly_commission">Commission</option>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Amount" type="number" value={financeAmount} onChange={(e) => setFinanceAmount(e.target.value)} placeholder="15000" />
              <Input label="Period" value={financePeriod} onChange={(e) => setFinancePeriod(e.target.value)} />
            </div>
            <Button type="submit" variant="success" className="w-full">Dispatch Allocation</Button>
          </form>
        </Card>

        {/* Tasking */}
        <Card>
          <CardHeader>
            <CardTitle>Direct Tasking</CardTitle>
            <div className="p-2 bg-one-orange/10 text-one-orange rounded-xl"><Briefcase size={20}/></div>
          </CardHeader>
          <form onSubmit={handleAssignTask} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Select label="Agent" value={taskReseller} onChange={(e) => setTaskReseller(e.target.value)}>
                {profiles.map(p => <option key={p.uid} value={p.uid}>{p.displayName}</option>)}
              </Select>
              <Input label="Start Date" type="date" value={taskWeekStart} onChange={(e) => setTaskWeekStart(e.target.value)} />
            </div>
            <Input label="Objective" value={taskObjective} onChange={(e) => setTaskObjective(e.target.value)} placeholder="Expand Kilifi units..." />
            <textarea
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 h-20 outline-none focus:ring-2 focus:ring-one-blue/20"
              placeholder="Daily directives..."
              value={taskDailyBreakdown}
              onChange={(e) => setTaskDailyBreakdown(e.target.value)}
            />
            <Button type="submit" variant="primary" className="w-full">Allocate Program</Button>
          </form>
        </Card>
      </div>

      {/* Directory Table */}
      <Card className="p-0 overflow-hidden">
        <CardHeader className="p-8 border-b border-slate-50">
          <div>
            <CardTitle>Workspace Registry</CardTitle>
            <CardDescription>Authorized regional accounts database</CardDescription>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-one-blue/20" placeholder="Search directory..." />
            </div>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-8 py-4">Name</th>
                <th className="px-4 py-4">Role</th>
                <th className="px-4 py-4">Sector</th>
                <th className="px-4 py-4">Passcode</th>
                <th className="px-8 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {profiles.map(p => {
                const isEditing = editingProfileId === p.uid;
                return (
                  <tr key={p.uid} className={`hover:bg-slate-50/30 transition-colors ${isEditing ? 'bg-one-blue/5' : ''}`}>
                    <td className="px-8 py-5">
                      {isEditing ? (
                        <input className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-sm font-bold" value={editDisplayName} onChange={(e)=>setEditDisplayName(e.target.value)} />
                      ) : (
                        <div>
                          <p className="text-sm font-bold text-slate-900">{p.displayName}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">{p.email}</p>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-5">
                      {isEditing ? (
                        <select className="text-xs font-bold border rounded p-1" value={editRole} onChange={(e)=>setEditRole(e.target.value as any)}>
                          <option value="reseller">Agent</option><option value="management">Oversight</option><option value="admin">Admin</option>
                        </select>
                      ) : (
                        <Badge variant={p.role === 'admin' ? 'red' : p.role === 'management' ? 'orange' : 'green'}>{p.role}</Badge>
                      )}
                    </td>
                    <td className="px-4 py-5 font-bold text-[11px] text-slate-700">
                       {isEditing && editRole === 'reseller' ? (
                         <select className="text-xs font-bold border rounded p-1" value={editArea} onChange={(e)=>setEditArea(e.target.value as any)}>
                           <option>Mombasa</option><option>Malindi</option><option>Kilifi</option><option>Kwale</option>
                         </select>
                       ) : (p.area || 'Global')}
                    </td>
                    <td className="px-4 py-5 font-mono text-one-indigo font-black text-xs">{p.password || '—'}</td>
                    <td className="px-8 py-5 text-right flex justify-end gap-2">
                      {isEditing ? (
                        <>
                          <Button size="sm" variant="success" onClick={()=>handleUpdateProfile(p.uid)}><Check size={14}/></Button>
                          <Button size="sm" variant="ghost" onClick={()=>setEditingProfileId(null)}><X size={14}/></Button>
                        </>
                      ) : (
                        <>
                          <button onClick={()=>{setEditingProfileId(p.uid); setEditDisplayName(p.displayName); setEditRole(p.role); setEditArea(p.area||'Mombasa');}} className="p-2 text-slate-300 hover:text-one-blue transition-colors"><Edit size={16}/></button>
                          <button onClick={()=>handleDeleteProfile(p.uid, p.displayName)} className="p-2 text-slate-300 hover:text-one-red transition-colors"><Trash2 size={16}/></button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
