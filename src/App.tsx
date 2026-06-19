import React, { useState, useEffect } from 'react';
import { db, googleSignIn, logoutUser } from './lib/firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { UserRole, UserProfile } from './types';
import AdminView from './components/AdminView';
import ManagementView from './components/ManagementView';
import ResellerView from './components/ResellerView';
import RequestLinkView from './components/RequestLinkView';
import { Logo } from './components/Logo';
import { 
  ShieldCheck, LogOut, RefreshCw, Layers, MapPin, 
  Settings, Users, Network, Link, HeartHandshake, Compass,
  ChevronRight, Laptop, UserCheck, ShieldAlert, BarChart3, HelpCircle,
  Menu, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [simulatedRole, setSimulatedRole] = useState<UserRole>('reseller');
  const [loading, setLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Parse public request form links
  const [publicReqId, setPublicReqId] = useState<string | null>(null);
  const [showPublicCreator, setShowPublicCreator] = useState(false);

  useEffect(() => {
    // Check parameters
    const params = new URLSearchParams(window.location.search);
    const reqValue = params.get('reqId');
    if (reqValue) {
      setPublicReqId(reqValue);
    }
    
    // Check if mode is request creation
    const mode = params.get('mode');
    if (mode === 'fill-request') {
      setShowPublicCreator(true);
    }

    // Recover cached spreadsheet ID
    const savedSheet = localStorage.getItem('central_spreadsheet_id');
    if (savedSheet) setSpreadsheetId(savedSheet);

    // Standard session storage restore for Google Sign In
    const savedToken = sessionStorage.getItem('google_access_token');
    // For local evaluation, check firebase auth state
    const unsubscribe = doc && setDoc && import('./lib/firebase').then(({ auth }) => {
      auth.onAuthStateChanged(async (currentUser) => {
        if (currentUser) {
          setUser(currentUser);
          await loadUserProfile(currentUser);
        } else {
          setUser(null);
          setProfile(null);
        }
        setLoading(false);
      });
    });

    return () => {
      // Unsubscribe cleanup handled on auth load
    };
  }, []);

  const loadUserProfile = async (currentUser: User) => {
    try {
      const userEmail = currentUser.email?.toLowerCase().trim() || '';

      // 1. Try to find user profile by real UID first
      const docRef = doc(db, 'users', currentUser.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data() as UserProfile;
        const isAdminEmail = userEmail === 'malingib9@gmail.com';
        if (isAdminEmail && data.role !== 'admin') {
          data.role = 'admin';
          const { updateDoc } = await import('firebase/firestore');
          await updateDoc(docRef, { role: 'admin' });
        }
        setProfile(data);
        setSimulatedRole(data.role);
      } else {
        // 2. Check if there is a pre-registered profile with a pseudo UID matching this email
        const usersQuery = query(collection(db, 'users'), where('email', '==', userEmail));
        const querySnap = await getDocs(usersQuery);

        if (!querySnap.empty) {
          const preRegDoc = querySnap.docs[0];
          const preRegData = preRegDoc.data() as UserProfile;

          // Delete old temporary pseudo-UID document if it is different
          if (preRegDoc.id !== currentUser.uid) {
            await deleteDoc(doc(db, 'users', preRegDoc.id));
          }

          // Move/save under the actual authenticated user UID
          const mergedProfile: UserProfile = {
            ...preRegData,
            uid: currentUser.uid,
            displayName: currentUser.displayName || preRegData.displayName || 'Coastal Agent',
          };

          await setDoc(doc(db, 'users', currentUser.uid), mergedProfile);
          setProfile(mergedProfile);
          setSimulatedRole(mergedProfile.role);
        } else {
          // 3. No pre-registry found, auto-provision fresh default account
          const isAdminEmail = userEmail === 'malingib9@gmail.com';
          const defaultRole: UserRole = isAdminEmail ? 'admin' : 'reseller';
          const newProfile: UserProfile = {
            uid: currentUser.uid,
            email: userEmail,
            displayName: currentUser.displayName || 'Coastal Agent',
            role: defaultRole,
            area: 'Mombasa' // Default active area
          };

          await setDoc(docRef, newProfile);
          setProfile(newProfile);
          setSimulatedRole(defaultRole);
        }
      }
    } catch (err) {
      console.error("Failed to sync user profile", err);
    }
  };

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        await loadUserProfile(result.user);
      }
    } catch (err) {
      console.error('Sign in failed:', err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    setUser(null);
    setProfile(null);
    sessionStorage.removeItem('google_access_token');
  };

  const saveSpreadsheetId = (id: string) => {
    setSpreadsheetId(id);
    localStorage.setItem('central_spreadsheet_id', id);
  };

  // If a public link request ID has been supplied, render recipient workspace immediately
  if (publicReqId) {
    return (
      <RequestLinkView 
        requestId={publicReqId} 
        onBackToApp={() => {
          // Clear query param and set state
          window.history.replaceState({}, document.title, window.location.pathname);
          setPublicReqId(null);
        }}
      />
    );
  }

  // If explicit link creation mode is engaged (allows recipient to submit request)
  if (showPublicCreator) {
    return (
      <RequestLinkView 
        requestId={null} 
        onBackToApp={() => {
          window.history.replaceState({}, document.title, window.location.pathname);
          setShowPublicCreator(false);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-900 flex flex-col lg:flex-row font-sans antialiased">
      
      {/* Mobile top navigation header */}
      <div className="lg:hidden flex items-center justify-between px-5 py-4 bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="flex items-center gap-2.5">
          <Logo size={28} />
          <span className="font-bold text-sm tracking-tight text-slate-950">Mobiwave ISP</span>
        </div>
        <div className="flex items-center gap-2">
          {user && (
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-4.5 h-4.5" /> : <Menu className="w-4.5 h-4.5" />}
            </button>
          )}
        </div>
      </div>

      {/* Authenticated Workspace with Sidebar & Main Page */}
      {user ? (
        <>
          {/* Left Sidebar Menu - styled to match the screenshot precisely */}
          <aside className={`
            ${mobileMenuOpen ? 'flex' : 'hidden'} 
            lg:flex w-full lg:w-60 bg-white border-r border-slate-200 flex-col h-screen sticky top-0 z-40 shrink-0
          `}>
            {/* Branding Header */}
            <div className="p-5 border-b border-slate-200 hidden lg:block">
              <div className="flex items-center gap-2.5">
                <Logo size={32} />
                <div className="min-w-0">
                  <span className="font-bold text-[14px] text-slate-950 block tracking-tight leading-none">Mobiwave Inc.</span>
                  <span className="text-[10px] text-teal-600 font-semibold block leading-tight mt-1">ISP Lead Matrix</span>
                </div>
              </div>
            </div>

            {/* Navigation Body */}
            <nav className="flex-1 p-3 space-y-5 overflow-y-auto">
              
              {/* Home / Portals Segment */}
              <div className="space-y-1">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2.5 py-1 mb-1.5">
                  Home
                </div>
                
                <button
                  onClick={() => { setSimulatedRole('reseller'); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md font-medium text-xs transition-all text-left cursor-pointer ${
                    simulatedRole === 'reseller' 
                      ? 'bg-slate-900 text-white font-semibold shadow-xs' 
                      : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
                  }`}
                >
                  <Users className={`w-4 h-4 shrink-0 ${simulatedRole === 'reseller' ? 'text-teal-400' : 'text-slate-450'}`} />
                  <span className="truncate">Reseller Dashboard</span>
                </button>

                <button
                  onClick={() => { setSimulatedRole('management'); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md font-medium text-xs transition-all text-left cursor-pointer ${
                    simulatedRole === 'management' 
                      ? 'bg-slate-900 text-white font-semibold shadow-xs' 
                      : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
                  }`}
                >
                  <BarChart3 className={`w-4 h-4 shrink-0 ${simulatedRole === 'management' ? 'text-teal-400' : 'text-slate-450'}`} />
                  <span className="truncate">Management Deck</span>
                </button>

                <button
                  onClick={() => { setSimulatedRole('admin'); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md font-medium text-xs transition-all text-left cursor-pointer ${
                    simulatedRole === 'admin' 
                      ? 'bg-slate-900 text-white font-semibold shadow-xs' 
                      : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
                  }`}
                >
                  <ShieldCheck className={`w-4 h-4 shrink-0 ${simulatedRole === 'admin' ? 'text-teal-400' : 'text-slate-450'}`} />
                  <span className="truncate">Administrative Hub</span>
                </button>
              </div>

              {/* Reference Documents Section */}
              <div className="space-y-1">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2.5 py-1 mb-1.5">
                  Documents
                </div>
                <button
                  onClick={() => { setShowPublicCreator(true); setMobileMenuOpen(false); }}
                  className="w-full flex items-center justify-between px-2.5 py-2 text-slate-600 hover:text-slate-950 hover:bg-slate-50 rounded-md text-xs font-medium text-left transition-all cursor-pointer"
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Link className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="truncate">Support Form</span>
                  </span>
                  <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                </button>
              </div>

              {/* Sync State Card */}
              <div className="p-3 bg-slate-50/70 border border-slate-200/50 rounded-lg space-y-1">
                <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Sync State</span>
                <p className="text-[10px] text-slate-600 leading-relaxed font-semibold">
                  {spreadsheetId ? "✓ Workspace Connected." : "⚠️ Sheets setup required."}
                </p>
              </div>

            </nav>

            {/* Profile widget footer */}
            <div className="p-3 bg-slate-50/80 border-t border-slate-200 mt-auto flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="profile" className="w-7.5 h-7.5 rounded-full border border-slate-200 shrink-0" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-7.5 h-7.5 rounded-full bg-slate-200 text-slate-850 font-bold flex items-center justify-center text-xs shrink-0">
                    {user.displayName?.charAt(0) || user.email?.charAt(0).toUpperCase() || 'A'}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-[11.5px] font-bold text-slate-850 truncate leading-none mb-1">{user.displayName || 'Coastal Agent'}</p>
                  <p className="text-[9px] font-mono text-slate-400 uppercase tracking-widest truncate leading-none">
                    {simulatedRole}
                  </p>
                </div>
              </div>

              <button 
                onClick={handleLogout}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-105 rounded-md transition-colors cursor-pointer"
                title="Sign out of workspace"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </aside>

          {/* Main Workspace Frame container */}
          <main className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
            
            {/* Header section on desktop top */}
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between shrink-0 gap-3">
              <div>
                <h1 className="text-lg font-extrabold text-slate-900 tracking-tight flex items-center gap-2 flex-wrap">
                  Mobiwave ISP Performance
                  <span className="text-slate-400 font-medium">/</span>
                  <span className="text-teal-600 text-sm font-semibold py-0.5 px-2 bg-teal-50 border border-teal-100 rounded-full uppercase tracking-wider font-mono">
                    {simulatedRole} Dashboard
                  </span>
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">Disbursements: biweekly support allocations • payroll payments: end of month.</p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span className="text-[11px] font-semibold px-2.5 py-1 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-lg flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                  System Sync: Active
                </span>
                
                <span className="hidden lg:inline-block text-[10px] text-slate-400 font-bold font-mono">
                  {profile?.area ? `AREA: ${profile.area}` : "ALL COAST SECTORS"}
                </span>
              </div>
            </header>

            {/* Actual dynamic dynamic content grids */}
            <div className="p-6 flex-1 space-y-6">
              
              <AnimatePresence mode="wait">
                <motion.div
                  key={simulatedRole}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  {simulatedRole === 'admin' && (
                    <AdminView 
                      onSpreadsheetCreated={saveSpreadsheetId} 
                      savedSpreadsheetId={spreadsheetId} 
                    />
                  )}

                  {simulatedRole === 'management' && (
                    <ManagementView currentUser={user} />
                  )}

                  {simulatedRole === 'reseller' && (
                    <ResellerView 
                      user={user} 
                      userArea={profile?.area || 'Mombasa'} 
                      spreadsheetId={spreadsheetId} 
                    />
                  )}
                </motion.div>
              </AnimatePresence>

            </div>

            {/* Compact footer credit inside right frame */}
            <footer className="py-4 border-t border-slate-200 bg-white text-center text-[10px] text-slate-400 font-mono mt-auto shrink-0">
              Mobiwave ISP Lead Procurement Matrix • Secure Google Workspace Integration Active
            </footer>

          </main>
        </>
      ) : (
        // Client-side authentication page (High-contrast and elegant)
        <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 bg-gradient-to-br from-[#f8fafc] to-[#f1f5f9]">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden text-center p-8 space-y-6 animate-fadeIn">
            
            <div className="space-y-2">
              <div className="inline-flex mb-2">
                <Logo size={72} />
              </div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900">Mobiwave ISP Portal</h2>
              <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                Sign in with Google Workspace to submit lead connections, manage biweekly operational support allocations, and track performance targets.
              </p>
            </div>

            {/* Public Referral Link Helpers */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-left text-slate-700 space-y-2.5">
              <span className="font-bold text-[10px] uppercase text-slate-400 tracking-wider">Recipient Form Links</span>
              <div className="space-y-1.5 font-sans leading-normal">
                <button 
                  onClick={() => setShowPublicCreator(true)}
                  className="w-full hover:bg-white text-left p-2.5 border border-slate-200 hover:border-slate-300 rounded-lg font-bold text-indigo-600 inline-flex items-center justify-between gap-1 transition-all cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Link className="w-3.5 h-3.5 text-indigo-500" />
                    Request biweekly support (Public Link)
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </button>
                <p className="text-[10px] text-slate-400 leading-normal">
                  *Form Links are public and accessible directly by recipients without sign-in to request funds & sign disbursement receipts on payment.
                </p>
              </div>
            </div>

            {/* Material Google Authenticator button */}
            <div className="pt-2">
              <button 
                onClick={handleLogin}
                disabled={isLoggingIn}
                className="w-full h-[40px] px-4 border border-[#dadce0] rounded-[4px] bg-white hover:bg-[#f7fafe] hover:border-[#d2e3fc] flex items-center justify-center gap-3 cursor-pointer text-[#3c4043] font-sans font-medium text-sm transition-all shadow-sm active:bg-slate-50"
              >
                <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-[18px] h-[18px] flex-shrink-0">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                </svg>
                <span>{isLoggingIn ? 'Establishing connection...' : 'Sign in with Google'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
