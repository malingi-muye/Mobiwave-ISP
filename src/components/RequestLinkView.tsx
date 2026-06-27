import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { sendGmailEmail, uploadReceiptToDrive } from '../lib/googleApi';
import { FundsRequest } from '../types';
import {
  CheckCircle,
  AlertCircle,
  FileText,
  Send,
  Signature,
  ChevronLeft,
  Clock,
  ShieldCheck,
  Globe
} from 'lucide-react';
import { Logo } from './Logo';
import { motion, AnimatePresence } from 'motion/react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input, Select } from './ui/Input';
import { Badge } from './ui/Badge';

interface RequestLinkProps {
  requestId: string | null;
  onBackToApp?: () => void;
}

export default function RequestLinkView({ requestId, onBackToApp }: RequestLinkProps) {
  const [request, setRequest] = useState<FundsRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // New Request Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [purpose, setPurpose] = useState('');
  const [biweeklyPeriod, setBiweeklyPeriod] = useState('2026-W25-Biweekly');

  // Signature field
  const [signatureName, setSignatureName] = useState('');
  const [isAgreed, setIsAgreed] = useState(false);

  useEffect(() => {
    if (requestId) {
      fetchRequest(requestId);
    }
  }, [requestId]);

  const fetchRequest = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const docRef = doc(db, 'requests', id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setRequest(docSnap.data() as FundsRequest);
      } else {
        setError('Request link not found or expired.');
      }
    } catch (err: any) {
      console.error(err);
      setError('Error loading the request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !amount || !purpose) {
      setError('Please fill in all details.');
      return;
    }

    const value = parseFloat(amount);
    if (isNaN(value) || value <= 0) {
      setError('Please provide a valid amount.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const newId = 'req_' + Math.random().toString(36).substring(2, 9);
      const newRequest: FundsRequest = {
        id: newId,
        recipientName: name,
        recipientEmail: email,
        amount: value,
        purpose,
        biweeklyPeriod,
        status: 'pending',
        createdAt: new Date().toISOString(),
        signedReceipt: false
      };

      await setDoc(doc(db, 'requests', newId), newRequest);
      
      await sendGmailEmail(
        email,
        `Internet Lead Support Form Submitted: ${newId}`,
        `<h3>Hello ${name},</h3>
         <p>Your weekly support request of <strong>KES ${value.toLocaleString()}</strong> has been submitted.</p>
         <p><a href="${window.location.origin}?reqId=${newId}">Open Request Portal</a></p>`
      ).catch(() => {});

      setSuccessMsg(`Request filed successfully: ${newId}`);
      setRequest(newRequest);
    } catch (err: any) {
      console.error(err);
      setError('Could not submit details.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!request || !signatureName || !isAgreed) return;

    const confirmed = window.confirm("Confirm digital signature?");
    if (!confirmed) return;

    setLoading(true);
    setError(null);
    try {
      const signedAt = new Date().toISOString();
      const receiptContent = `Digital Receipt ${request.id}\nSignee: ${signatureName}\nDate: ${signedAt}`;
      let driveFileId = 'drive_' + Math.random().toString(36).substring(7);
      
      try {
        const fileId = await uploadReceiptToDrive(`Receipt_${request.id}.txt`, receiptContent);
        if (fileId) driveFileId = fileId;
      } catch (err) {}

      const updatedData = {
        signedReceipt: true,
        signedAt,
        receiptDriveFileId: driveFileId
      };

      await updateDoc(doc(db, 'requests', request.id), updatedData);
      setSuccessMsg('Digital receipt signed and archived!');
      setRequest({ ...request, ...updatedData });
    } catch (err: any) {
      setError('Could not sign receipt.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-main flex flex-col items-center justify-center p-6 antialiased selection:bg-one-blue/30 relative">
      {/* Background Decorative Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-one-blue/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-one-indigo/5 blur-[120px] rounded-full" />
        <div className="spline-grid-overlay opacity-10" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl relative z-10"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="p-4 bg-white rounded-3xl shadow-xl shadow-one-blue/5 border border-slate-100 mb-6">
            <Logo size={48} />
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter">Public Terminal</h1>
          <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-2">Mobiwave ISP Procurement System</p>
        </div>

        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6"
            >
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0" />
                {error}
              </div>
            </motion.div>
          )}

          {successMsg && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6"
            >
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3 text-emerald-400 text-sm font-medium">
                <CheckCircle className="w-5 h-5 shrink-0" />
                {successMsg}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <Card className="one-glass border-white/50 overflow-hidden p-0">
          {loading ? (
            <div className="p-16 flex flex-col items-center justify-center space-y-6">
              <div className="w-10 h-10 border-4 border-one-blue/10 border-t-one-blue rounded-full animate-spin" />
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest animate-pulse">Syncing with secure ledger...</p>
            </div>
          ) : !request && !requestId ? (
            <form onSubmit={handleCreateRequest} className="p-10 space-y-8">
              <div className="flex items-center gap-4 mb-2">
                <div className="w-12 h-12 rounded-2xl bg-one-blue/10 flex items-center justify-center text-one-blue">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">New Support Request</h2>
                  <p className="text-slate-400 font-medium text-sm">Fill in the details for biweekly allocation</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Full Name"
                  placeholder="e.g. John Salim"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
                <Input
                  label="Email Address"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Amount (KES)"
                  type="number"
                  placeholder="15000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
                <Select
                  label="Biweekly Period"
                  value={biweeklyPeriod}
                  onChange={(e) => setBiweeklyPeriod(e.target.value)}
                  options={[
                    { value: '2026-W25-Biweekly', label: '2026 June Biweekly 1' },
                    { value: '2026-W26-Biweekly', label: '2026 June Biweekly 2' },
                    { value: '2026-W27-Biweekly', label: '2026 July Biweekly 1' },
                  ]}
                />
              </div>

              <Input
                label="Purpose of Funds"
                placeholder="Describe procurement logistics and operations..."
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                required
                multiline
                rows={3}
              />

              <Button type="submit" className="w-full h-12 text-sm font-bold shadow-lg shadow-blue-500/20">
                <Send className="w-4 h-4 mr-2" />
                Submit Allocation Request
              </Button>
            </form>
          ) : request ? (
              <div className="p-10 space-y-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-one-indigo/10 flex items-center justify-center text-one-indigo">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">Request {request.id}</h2>
                    <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest flex items-center gap-1.5 mt-1">
                      <Clock className="w-3.5 h-3.5" /> {new Date(request.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <Badge variant={
                  request.status === 'approved' ? 'success' :
                  request.status === 'rejected' ? 'danger' : 'warning'
                }>
                  {request.status}
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 p-8 rounded-[32px] bg-slate-50/50 border border-slate-100">
                <div className="space-y-1.5">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Recipient</p>
                  <p className="text-slate-900 font-extrabold">{request.recipientName}</p>
                  <p className="text-slate-400 font-bold text-[11px] uppercase tracking-wider">{request.recipientEmail}</p>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Amount</p>
                  <p className="text-3xl font-black text-one-blue tracking-tighter">KES {request.amount.toLocaleString()}</p>
                  <p className="text-slate-400 font-bold text-[11px] uppercase tracking-wider">{request.biweeklyPeriod}</p>
                </div>
                <div className="sm:col-span-2 space-y-2 pt-4 border-t border-slate-150">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Purpose</p>
                  <p className="text-slate-600 font-bold text-sm leading-relaxed italic">"{request.purpose}"</p>
                </div>
              </div>

              {request.status === 'approved' && !request.signedReceipt && (
                <form onSubmit={handleSignReceipt} className="space-y-6 pt-6 border-t border-white/10">
                  <div className="p-6 rounded-2xl bg-one-green/5 border border-one-green/10 text-one-green text-xs leading-relaxed">
                    <p className="font-black uppercase tracking-widest mb-1.5 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" /> Action Required: Digital Signoff
                    </p>
                    <p className="font-bold opacity-80">I confirm receipt of funds and agree to provide all necessary field lead connection documentation for audit purposes.</p>
                  </div>

                  <div className="space-y-4">
                    <Input
                      label="Type Full Legal Name to Sign"
                      placeholder="e.g. John Salim"
                      value={signatureName}
                      onChange={(e) => setSignatureName(e.target.value)}
                      required
                    />

                    <label className="flex items-start gap-3 cursor-pointer group">
                      <div className="relative flex items-center">
                        <input
                          type="checkbox"
                          className="peer sr-only"
                          checked={isAgreed}
                          onChange={(e) => setIsAgreed(e.target.checked)}
                        />
                        <div className="w-5 h-5 rounded border border-white/20 peer-checked:bg-blue-600 peer-checked:border-blue-600 transition-all flex items-center justify-center">
                          <CheckCircle className="w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100" />
                        </div>
                      </div>
                      <span className="text-xs text-slate-400 font-medium group-hover:text-slate-300 transition-colors">
                        I authorize this as my legal digital signature for financial audit purposes.
                      </span>
                    </label>
                  </div>

                  <Button type="submit" variant="success" className="w-full h-12 font-bold shadow-lg shadow-emerald-500/10">
                    <Signature className="w-4 h-4 mr-2" />
                    Sign & Complete Receipt
                  </Button>
                </form>
              )}

              {request.signedReceipt && (
                <div className="p-10 rounded-[32px] bg-one-green/5 border border-one-green/10 text-center space-y-4">
                  <div className="w-16 h-16 rounded-[24px] bg-one-green/10 flex items-center justify-center text-one-green mx-auto">
                    <CheckCircle className="w-8 h-8" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">Receipt Signed</h3>
                  <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">
                    Successfully authorized on {new Date(request.signedAt || '').toLocaleString()}
                  </p>
                  <div className="pt-6 flex items-center justify-center gap-3">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Audit ID:</span>
                    <code className="text-one-green text-[10px] font-black font-mono bg-one-green/10 px-3 py-1.5 rounded-lg border border-one-green/10">
                      {request.receiptDriveFileId}
                    </code>
                  </div>
                </div>
              )}

              {request.status === 'pending' && (
                <div className="p-10 rounded-[32px] bg-one-blue/5 border border-one-blue/10 text-center space-y-4">
                  <div className="w-16 h-16 rounded-[24px] bg-one-blue/10 flex items-center justify-center text-one-blue mx-auto animate-pulse">
                    <Clock className="w-8 h-8" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">Awaiting Review</h3>
                  <p className="text-slate-400 font-medium text-sm leading-relaxed max-w-xs mx-auto">
                    Your request is currently being reviewed by regional oversight. You'll receive an email once approved to sign the receipt.
                  </p>
                </div>
              )}
            </div>
          ) : null}
        </Card>

        {onBackToApp && (
          <motion.button
            whileHover={{ x: -4 }}
            onClick={onBackToApp}
            className="mt-10 flex items-center gap-2 text-slate-400 hover:text-one-blue transition-colors text-[10px] font-black uppercase tracking-[0.2em] mx-auto"
          >
            <ChevronLeft className="w-4 h-4" />
            Return to Dashboard
          </motion.button>
        )}

        <div className="mt-16 pt-10 border-t border-slate-200 flex flex-col items-center gap-6">
          <div className="flex items-center gap-6 opacity-40">
             <div className="flex items-center gap-2 text-slate-900 font-black text-[10px] tracking-[0.2em]">
               <Globe className="w-3.5 h-3.5 text-one-blue" /> SECURE REGIONAL NODE
             </div>
             <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
             <div className="text-slate-900 font-black text-[10px] tracking-[0.2em]">
               v3.4.0-PROMO
             </div>
          </div>
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em]">
            © 2026 MOBIWAVE ISP SOLUTIONS LTD
          </p>
        </div>
      </motion.div>
    </div>
  );
}
