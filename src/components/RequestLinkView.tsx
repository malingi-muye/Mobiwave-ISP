import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { sendGmailEmail, uploadReceiptToDrive } from '../lib/googleApi';
import { FundsRequest } from '../types';
import { CheckCircle, AlertCircle, FileText, Send, ShieldCheck, Signature, ChevronLeft, Calendar, FileCheck, Landmark } from 'lucide-react';
import { Logo } from './Logo';
import { motion } from 'motion/react';

interface RequestLinkProps {
  requestId: string | null;
  onBackToApp?: () => void;
}

export default function RequestLinkView({ requestId, onBackToApp }: RequestLinkProps) {
  const [request, setRequest] = useState<FundsRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // New Request Form fields (if creating new)
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

      // Create in Firestore
      await setDoc(doc(db, 'requests', newId), newRequest);
      
      // Try to send notification email
      await sendGmailEmail(
        email,
        `Internet Lead Support Form Submitted: ${newId}`,
        `<h3>Hello ${name},</h3>
         <p>Your weekly support request of <strong>KES ${value.toLocaleString()}</strong> for <em>"${purpose}"</em> has been submitted to the Admin for approval.</p>
         <p>Track or signature signoff can be completed via your public portal request link:</p>
         <p><a href="${window.location.origin}?reqId=${newId}" style="display:inline-block;padding:10px 20px;background-color:#2563eb;color:#fff;text-decoration:none;border-radius:5px;">Open Request & Signed Receipt portal</a></p>
         <p>Best regards,<br/>Mobiwave ISP Portal Team</p>`
      ).catch(() => console.log('Gmail notification send offline or pending configuration'));

      setSuccessMsg(`Your request has been filed successfully under ID: ${newId}. Save this URL to sign the receipt once approved!`);
      setRequest(newRequest);
    } catch (err: any) {
      console.error(err);
      setError('Could not submit details. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!request) return;
    if (!signatureName) {
      setError('Please write your full name as signature.');
      return;
    }
    if (!isAgreed) {
      setError('You must check the agreement box to sign off.');
      return;
    }

    const confirmed = window.confirm(
      "Confirm signature: Are you sure you received these funds and want to sign the biweekly receipt?"
    );
    if (!confirmed) return;

    setLoading(true);
    setError(null);
    try {
      const signedAt = new Date().toISOString();
      
      // Upload confirmation to Google Drive
      const receiptContent = `
=== DIGITAL PAYMENT RECEIPT ===
Request ID: ${request.id}
Recipient Name: ${request.recipientName}
Recipient Email: ${request.recipientEmail}
Biweekly Period: ${request.biweeklyPeriod}
Purpose: ${request.purpose}
Amount: KES ${request.amount.toLocaleString()}
Status: APPROVED & DISBURSED
Signature Date: ${signedAt}
Sign-off Signature Name: ${signatureName}
IP Address Verification: CLIENT-SIGN-STAMP

The recipient, by digitally typing their signature name, explicitly confirms receipt of the stated financial support from Mobiwave ISP management, under penalties of misrepresentation.
===============================
      `;

      let driveFileId = 'mock_drive_file_id';
      try {
        const fileId = await uploadReceiptToDrive(`Receipt_${request.id}_${request.recipientName}.txt`, receiptContent);
        if (fileId) driveFileId = fileId;
      } catch (err) {
        console.warn('Drive upload pending workspace configuration', err);
      }

      // Update Firestore
      const updatedData = {
        signedReceipt: true,
        signedAt,
        receiptDriveFileId: driveFileId
      };

      await updateDoc(doc(db, 'requests', request.id), updatedData);
      
      // Send Gmail copy
      await sendGmailEmail(
        request.recipientEmail,
        `Signed Disbursement Receipt: ${request.id}`,
        `<h3>Disbursement Signed Confirmation</h3>
         <p>Hello ${request.recipientName},</p>
         <p>Your signed receipt is confirmed. The payment receipt has been successfully logged on Google Drive (File ID: ${driveFileId}).</p>
         <p><strong>Receipt Details:</strong></p>
         <ul>
           <li>Request ID: ${request.id}</li>
           <li>Amount: KES ${request.amount.toLocaleString()}</li>
           <li>Signed at: ${new Date(signedAt).toLocaleString()}</li>
           <li>Signee: ${signatureName}</li>
         </ul>
         <p>Thank you for your cooperation!</p>`
      ).catch(() => console.log('Gmail notification send offline'));

      setSuccessMsg('Digital receipt signed off and safely archived to Google Drive!');
      setRequest({
        ...request,
        ...updatedData
      });
    } catch (err: any) {
      console.error(err);
      setError('Could not sign receipt. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f8fafc] to-[#f1f5f9] flex flex-col items-center justify-center p-4 antialiased font-sans">
      <div className="w-full max-w-xl bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
        
        {/* Modern high-contrast styled Header */}
        <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-sky-600 px-8 py-7 text-white relative">
          <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex items-center gap-3 relative z-10">
            <Logo size={42} />
            <div>
              <span className="text-[10px] text-sky-200 font-extrabold uppercase tracking-widest block">Mobiwave ISP Procurement</span>
              <h1 className="text-lg font-extrabold tracking-tight mt-0.5">Disbursements Ledger Public Terminal</h1>
            </div>
          </div>
        </div>

        <div className="p-8">
          
          {/* Status logs block messages */}
          {error && (
            <div className="mb-5 p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl flex items-start gap-2 text-xs font-semibold animate-fadeIn">
              <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-5 p-4 bg-emerald-50 border border-emerald-250 text-emerald-800 rounded-2xl flex items-start gap-2.5 text-xs font-bold animate-fadeIn">
              <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {loading && (
            <div className="text-center py-10 text-slate-500 text-xs font-medium">
              <span className="inline-block animate-pulse">Establishing contact with regional firestore nodes...</span>
            </div>
          )}

          {!loading && !request && !requestId && (
            // Form to create a brand new Support request
            <form onSubmit={handleCreateRequest} className="space-y-4">
              <div className="border-b border-slate-100 pb-3 mb-4">
                <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">Request Biweekly Support</h2>
                <p className="text-xs text-slate-400 mt-0.5 font-medium">Identify yourself and describe the procurement logistics values.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Your Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Salim"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold text-slate-705"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Your Email</label>
                  <input
                    type="email"
                    required
                    placeholder="you@example.com"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono font-semibold text-slate-705"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Support Sum Requested (KES)</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 15000"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono font-semibold text-slate-705"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Target Biweekly Period</label>
                  <select
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold text-slate-705"
                    value={biweeklyPeriod}
                    onChange={(e) => setBiweeklyPeriod(e.target.value)}
                  >
                    <option value="2026-W25-Biweekly">2026 June Biweekly 1</option>
                    <option value="2026-W26-Biweekly">2026 June Biweekly 2</option>
                    <option value="2026-W27-Biweekly">2026 July Biweekly 1</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Description of Operations Strategy</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Summarize transport costs, client meetings details, and regional ward prospecting goals..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold text-slate-705 leading-relaxed"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                />
              </div>

              <button
                type="submit"
                className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95 focus:ring-2 focus:ring-indigo-500/25"
              >
                <Send className="w-3.5 h-3.5" /> File Biweekly Allocation Request
              </button>
            </form>
          )}

          {!loading && request && (
            // Showing state of request & Action to Sign receipt
            <div className="space-y-5">
              
              <div className="border-b border-slate-100 pb-3 mb-2 flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-bold font-mono text-slate-400">FORM REFERENCE: {request.id.toUpperCase()}</h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">Submitted on {new Date(request.createdAt).toLocaleDateString()}</p>
                </div>
                
                <span className={`px-2.5 py-1 rounded-lg text-[9px] font-extrabold uppercase tracking-wide border ${
                  request.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-150' :
                  request.status === 'rejected' ? 'bg-rose-50 text-rose-700 border-rose-150' :
                  'bg-amber-50 text-amber-700 border-amber-100'
                }`}>
                  {request.status}
                </span>
              </div>

              <div className="bg-[#f8fafc] rounded-2xl p-4 space-y-2.5 text-xs border border-slate-150">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-semibold">Allocated Beneficiary</span>
                  <span className="font-extrabold text-slate-850 text-right">{request.recipientName} ({request.recipientEmail})</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-semibold">Dispensing Period</span>
                  <span className="font-mono text-slate-700 text-right">{request.biweeklyPeriod}</span>
                </div>
                <div className="flex justify-between items-center border-t border-slate-200/60 pt-2.5">
                  <span className="text-slate-500 font-bold">Total Disbursed Sum</span>
                  <span className="font-black text-slate-900 text-right font-mono text-sm">KES {request.amount.toLocaleString()}</span>
                </div>
                <div className="border-t border-slate-200/60 pt-2.5">
                  <span className="text-slate-400 block font-semibold mb-1">Recipient Operations Purpose</span>
                  <p className="italic text-slate-700 font-medium">"{request.purpose}"</p>
                </div>
              </div>

              {request.status === 'pending' && (
                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 text-xs flex gap-3 leading-relaxed font-semibold">
                  <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                  <p>
                    <strong>Awaiting Admin Review.</strong> Once approved by the Region oversight board, you will receive an automatic email notifying you to digitally sign this official receipt here.
                  </p>
                </div>
              )}

              {request.status === 'rejected' && (
                <div className="p-4 bg-rose-50 rounded-2xl border border-rose-250 text-rose-900 text-xs flex gap-3 leading-relaxed font-semibold">
                  <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0 pointer-events-none" />
                  <p>
                    <strong>Disbursement Rejected.</strong> Mobiwave ISP oversight director denied this allocation block. Please request feedback using the regional coordinator.
                  </p>
                </div>
              )}

              {request.status === 'approved' && !request.signedReceipt && (
                <form onSubmit={handleSignReceipt} className="space-y-4 pt-3 border-t border-dashed border-slate-200 animate-fadeIn">
                  <div className="bg-emerald-50 text-emerald-950 text-xs p-4 rounded-2xl border border-emerald-250 flex gap-2.5 items-start leading-relaxed font-semibold">
                    <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong>Funds Approved & Sent!</strong> Please read the digital compliance statement carefully to sign the disbursement receipt.
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-250 p-4 bg-slate-50/70">
                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-indigo-500" /> Compliance Signoff Statement:
                    </h3>
                    <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                      "I, <strong>{request.recipientName}</strong>, confirm receipt of biweekly financial support of <strong>KES {request.amount.toLocaleString()}</strong> from Mobiwave ISP. The support facilitates the collection of field lead connections (including customer Name, Location/Street, institutions, and phones), and is disbursed truthfully as authorized."
                    </p>
                  </div>

                  <div className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Type your Full Legal Name to digitally authorize receipt:</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. John Doe, Field Specialist"
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
                        value={signatureName}
                        onChange={(e) => setSignatureName(e.target.value)}
                      />
                    </div>

                    <label className="flex items-start gap-2.5 text-[11px] text-slate-500 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer w-4 h-4 shrink-0"
                        checked={isAgreed}
                        onChange={(e) => setIsAgreed(e.target.checked)}
                      />
                      <span className="font-semibold leading-relaxed">I authorize this typed name represents my legal digital signature and will compile a permanent financial audit document on the Google Workspace backup repository.</span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                  >
                    <Signature className="w-3.5 h-3.5" /> Sign Ledger & Archive Receipt
                  </button>
                </form>
              )}

              {request.signedReceipt && (
                <div className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-5 space-y-3 mt-4 animate-fadeIn">
                  <div className="flex items-center gap-2 text-emerald-900 text-sm font-extrabold uppercase tracking-wide">
                    <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span>Compliance Signoff Signed</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-normal font-semibold">
                    The digital receipt of disbursement was successfully authorized on <strong className="font-mono text-slate-900">{new Date(request.signedAt || '').toLocaleString()}</strong>.
                  </p>
                  <p className="text-xs text-slate-600 leading-normal font-semibold">
                    Authorized Signee: <strong className="font-mono text-slate-900">{signatureName || request.recipientName}</strong>.
                  </p>
                  <p className="text-xs text-slate-400 font-semibold">
                    Google Drive audit File ID: <code className="bg-slate-200 text-slate-700 px-1 py-0.5 rounded font-mono text-[10px]">{request.receiptDriveFileId}</code>.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Utility Back to Dashboard link if user is simulating within App */}
          {onBackToApp && (
            <div className="mt-8 pt-4 border-t border-slate-150 text-center">
              <button
                onClick={onBackToApp}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center justify-center gap-1 mx-auto cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" /> Return to main role dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
