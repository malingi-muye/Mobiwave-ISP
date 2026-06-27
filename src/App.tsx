import React, { useState, useEffect } from 'react';
import { db, googleSignIn, logoutUser, auth } from './lib/firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs, deleteDoc, updateDoc } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { UserRole, UserProfile } from './types';
import AdminView from './components/AdminView';
import ManagementView from './components/ManagementView';
import ResellerView from './components/ResellerView';
import RequestLinkView from './components/RequestLinkView';
import { Logo } from './components/Logo';
import { Button } from './components/ui/Button';
import { Badge } from './components/ui/Badge';
import { Input } from './components/ui/Input';
import { Card } from './components/ui/Card';
import { 
  ShieldCheck, LogOut, RefreshCw, LayoutDashboard, 
  Activity, FileText, Menu, X, ChevronRight, Link
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

  const [publicReqId, setPublicReqId] = useState<string | null>(null);
  const [showPublicCreator, setShowPublicCreator] = useState(false);

  const [activeTab, setActiveTab] = useState<'google' | 'passcode'>('google');
  const [bypassEmail, setBypassEmail] = useState('');
  const [bypassCode, setBypassCode] = useState('');
  const [bypassError, setBypassError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reqValue = params.get('reqId');
    if (reqValue) setPublicReqId(reqValue);
    
    const mode = params.get('mode');
    if (mode === 'fill-request') setShowPublicCreator(true);

    const savedSheet = localStorage.getItem('central_spreadsheet_id');
    if (savedSheet) setSpreadsheetId(savedSheet);

    getDoc(doc(db, 'settings', 'sheets'))
      .then((sheetDoc) => {
        if (sheetDoc.exists()) {
          const cloudSpreadsheetId = sheetDoc.data()?.spreadsheetId;
          if (cloudSpreadsheetId) {
            setSpreadsheetId(cloudSpreadsheetId);
            localStorage.setItem('central_spreadsheet_id', cloudSpreadsheetId);
          } else if (savedSheet) {
            setDoc(doc(db, 'settings', 'sheets'), { 
              spreadsheetId: savedSheet, 
              updatedAt: new Date().toISOString() 
            });
          }
        } else if (savedSheet) {
          setDoc(doc(db, 'settings', 'sheets'), { 
            spreadsheetId: savedSheet, 
            updatedAt: new Date().toISOString() 
          });
        }
      });

    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        await loadUserProfile(currentUser);
      } else {
        const cachedBypass = sessionStorage.getItem('bypass_user');
        if (cachedBypass) {
          try {
            const sessionData = JSON.parse(cachedBypass);
            const mockUser = {
              uid: sessionData.uid,
              email: sessionData.email,
              displayName: sessionData.displayName,
              emailVerified: true,
              isAnonymous: false,
              providerId: 'password_bypass',
            } as unknown as User;
            setUser(mockUser);
            setProfile(sessionData);
            setSimulatedRole(sessionData.role);
          } catch (e) {
            sessionStorage.removeItem('bypass_user');
            setUser(null);
          }
        } else {
          setUser(null);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loadUserProfile = async (currentUser: User) => {
    try {
      const userEmail = currentUser.email?.toLowerCase().trim() || '';

      // Silent cleanup code for muyepreston@gmail.com
      try {
        const cleanupQuery = query(collection(db, 'users'), where('email', '==', 'muyepreston@gmail.com'));
        const cleanupSnap = await getDocs(cleanupQuery);
        for (const cleanupDoc of cleanupSnap.docs) {
          await deleteDoc(doc(db, 'users', cleanupDoc.id));
        }
      } catch (err) {}

      const docRef = doc(db, 'users', currentUser.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data() as UserProfile;
        const isAdminEmail = userEmail === 'malingib9@gmail.com';
        if (isAdminEmail && data.role !== 'admin') {
          data.role = 'admin';
          await updateDoc(docRef, { role: 'admin' });
        }
        setProfile(data);
        setSimulatedRole(data.role);
      } else {
        const usersQuery = query(collection(db, 'users'), where('email', '==', userEmail));
        const querySnap = await getDocs(usersQuery);

        if (!querySnap.empty) {
          const preRegDoc = querySnap.docs[0];
          const preRegData = preRegDoc.data() as UserProfile;
          if (preRegDoc.id !== currentUser.uid) await deleteDoc(doc(db, 'users', preRegDoc.id));

          const mergedProfile: UserProfile = {
            ...preRegData,
            uid: currentUser.uid,
            displayName: currentUser.displayName || preRegData.displayName || 'Coastal Agent',
          };

          await setDoc(doc(db, 'users', currentUser.uid), mergedProfile);
          setProfile(mergedProfile);
          setSimulatedRole(mergedProfile.role);
        } else {
          const isAdminEmail = userEmail === 'malingib9@gmail.com';
          const defaultRole: UserRole = isAdminEmail ? 'admin' : 'reseller';
          const newProfile: UserProfile = {
            uid: currentUser.uid,
            email: userEmail,
            displayName: currentUser.displayName || 'Coastal Agent',
            role: defaultRole,
            area: 'Mombasa'
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
    sessionStorage.removeItem('bypass_user');
  };

  const handleBypassLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setBypassError(null);
    try {
      const q = query(collection(db, 'users'), where('email', '==', bypassEmail.toLowerCase().trim()));
      const snap = await getDocs(q);

      if (snap.empty) {
        setBypassError('Account not registered.');
        return;
      }

      const userData = snap.docs[0].data() as UserProfile;
      if (userData.password?.trim() !== bypassCode.trim()) {
        setBypassError('Invalid passcode.');
        return;
      }

      const mockUser = {
        uid: userData.uid,
        email: userData.email,
        displayName: userData.displayName,
        emailVerified: true,
        isAnonymous: false,
        providerId: 'password_bypass'
      } as unknown as User;

      sessionStorage.setItem('bypass_user', JSON.stringify(userData));
      setUser(mockUser);
      setProfile(userData);
      setSimulatedRole(userData.role);
    } catch (err) {
      setBypassError('Auth failed.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const saveSpreadsheetId = async (id: string) => {
    setSpreadsheetId(id);
    localStorage.setItem('central_spreadsheet_id', id);
    await setDoc(doc(db, 'settings', 'sheets'), { spreadsheetId: id, updatedAt: new Date().toISOString() });
  };

  if (publicReqId) return <RequestLinkView requestId={publicReqId} onBackToApp={() => { window.history.replaceState({}, '', '/'); setPublicReqId(null); }} />;
  if (showPublicCreator) return <RequestLinkView requestId={null} onBackToApp={() => { window.history.replaceState({}, '', '/'); setShowPublicCreator(false); }} />;

  return (
    <div className="min-h-screen bg-bg-main text-foreground flex flex-col lg:flex-row antialiased relative">
      <div className="spline-grid-overlay opacity-20" />
      
      {/* Mobile Nav */}
      <div className="lg:hidden flex items-center justify-between px-6 py-4 one-glass border-b border-white/30 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <Logo size={28} />
          <span className="font-extrabold text-sm tracking-tight">Mobiwave</span>
        </div>
        {user && (
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 bg-white/50 rounded-xl">
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        )}
      </div>

      {user ? (
        <>
          {/* Sidebar */}
          <aside className={`
            ${mobileMenuOpen ? 'flex' : 'hidden'} 
            lg:flex w-full lg:w-72 one-glass-dark lg:m-4 lg:rounded-[32px] flex-col h-[calc(100vh-32px)] sticky top-4 z-40 shrink-0
          `}>
            <div className="p-8">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-white rounded-2xl">
                  <Logo size={32} />
                </div>
                <div>
                  <h2 className="font-black text-lg tracking-tighter leading-none">Mobiwave</h2>
                  <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest mt-1">Lead Matrix v3.4</p>
                </div>
              </div>
            </div>

            <nav className="flex-1 px-4 space-y-2">
              <div className="px-4 py-2 text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Dashboards</div>
              
              <SidebarItem 
                active={simulatedRole === 'reseller'} 
                icon={<LayoutDashboard size={20} />} 
                label="Field Agent" 
                onClick={() => { setSimulatedRole('reseller'); setMobileMenuOpen(false); }} 
              />
              <SidebarItem 
                active={simulatedRole === 'management'} 
                icon={<Activity size={20} />} 
                label="Oversight" 
                onClick={() => { setSimulatedRole('management'); setMobileMenuOpen(false); }} 
              />
              <SidebarItem 
                active={simulatedRole === 'admin'} 
                icon={<ShieldCheck size={20} />} 
                label="System Admin" 
                onClick={() => { setSimulatedRole('admin'); setMobileMenuOpen(false); }} 
              />

              <div className="px-4 py-6 text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Tools</div>
              <SidebarItem 
                icon={<FileText size={20} />} 
                label="Support Form" 
                onClick={() => { setShowPublicCreator(true); setMobileMenuOpen(false); }} 
              />
            </nav>

            <div className="p-6 mt-auto">
              {/* Sync State Card */}
              <div className="mb-6 p-4 bg-white/5 rounded-2xl space-y-2">
                <span className="text-[9px] uppercase font-black text-white/30 tracking-widest block">Sync State</span>
                <p className="text-[10px] text-white/70 font-bold flex items-center gap-2">
                  {spreadsheetId ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-one-green shadow-[0_0_8px_rgba(52,199,89,0.4)]" />
                      Connected
                    </>
                  ) : (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-one-orange shadow-[0_0_8px_rgba(255,149,0,0.4)]" />
                      Pending Setup
                    </>
                  )}
                </p>
              </div>

              <div className="one-glass bg-white/10 rounded-3xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-one-blue flex items-center justify-center font-black text-sm">
                    {user.displayName?.charAt(0) || 'A'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">{user.displayName || 'Agent'}</p>
                    <p className="text-[10px] font-bold text-white/50 truncate uppercase">{simulatedRole}</p>
                  </div>
                </div>
                <button onClick={handleLogout} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                  <LogOut size={18} className="text-white/70" />
                </button>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
            <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <Badge variant="blue" className="mb-3">Live Network Status: Active</Badge>
                <h1 className="text-4xl font-black tracking-tighter text-slate-900">
                  {simulatedRole === 'reseller' && "Agent Performance"}
                  {simulatedRole === 'management' && "Regional Oversight"}
                  {simulatedRole === 'admin' && "System Administration"}
                </h1>
                <p className="text-slate-400 font-medium mt-2 max-w-xl">
                  Monitoring lead procurement, financial disbursements, and regional internet expansion metrics in real-time.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Sector</p>
                  <p className="font-bold text-slate-900">{profile?.area || 'All Sectors'}</p>
                </div>
                <div className="w-12 h-12 rounded-2xl one-card flex items-center justify-center text-one-blue">
                  <RefreshCw size={24} className={loading ? 'animate-spin' : ''} />
                </div>
              </div>
            </header>

            <AnimatePresence mode="wait">
              <motion.div
                key={simulatedRole}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 0.4, cubicBezier: [0.4, 0, 0.2, 1] }}
              >
                {simulatedRole === 'admin' && <AdminView onSpreadsheetCreated={saveSpreadsheetId} savedSpreadsheetId={spreadsheetId} />}
                {simulatedRole === 'management' && <ManagementView currentUser={user} />}
                {simulatedRole === 'reseller' && <ResellerView user={user} userArea={profile?.area || 'Mombasa'} spreadsheetId={spreadsheetId} />}
              </motion.div>
            </AnimatePresence>

            <footer className="mt-20 py-8 border-t border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <span>© 2026 Mobiwave ISP Matrix</span>
              <div className="flex gap-6">
                <span>System Secure</span>
                <span>Google Cloud Connected</span>
              </div>
            </footer>
          </main>
        </>
      ) : (
        /* Login Screen */
        <div className="min-h-screen w-full flex items-center justify-center p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full">
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-one-blue/10 blur-[120px] rounded-full animate-pulse" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-one-indigo/10 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
          </div>

          <Card className="w-full max-w-[480px] p-12 relative z-10 text-center space-y-10 rounded-[48px]">
            <div className="space-y-4">
              <div className="w-24 h-24 bg-one-blue/5 rounded-[32px] flex items-center justify-center mx-auto mb-8 shadow-xl shadow-one-blue/5">
                <Logo size={56} />
              </div>
              <h2 className="text-4xl font-black tracking-tighter text-slate-900">Mobiwave Portal</h2>
              <p className="text-slate-400 font-medium max-w-[280px] mx-auto leading-relaxed text-sm">
                Sign in with Google Workspace to submit lead connections, manage allocations, and track targets.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 text-left space-y-4">
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Recipient Form Links</span>
               <button 
                 onClick={() => setShowPublicCreator(true)}
                 className="w-full bg-white hover:bg-slate-50 p-4 border border-slate-200 rounded-2xl flex items-center justify-between group transition-all"
               >
                 <div className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded-xl bg-one-blue/5 text-one-blue flex items-center justify-center"><Link size={16}/></div>
                   <span className="text-sm font-bold text-slate-900">Request Support (Public)</span>
                 </div>
                 <ChevronRight size={16} className="text-slate-300 group-hover:text-one-blue transition-colors" />
               </button>
            </div>

            <div className="bg-slate-50 p-2 rounded-2xl flex border border-slate-100">
              <button 
                onClick={() => setActiveTab('google')}
                className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'google' ? 'bg-white shadow-md text-one-blue' : 'text-slate-400'}`}
              >
                Google SSO
              </button>
              <button 
                onClick={() => setActiveTab('passcode')}
                className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'passcode' ? 'bg-white shadow-md text-one-blue' : 'text-slate-400'}`}
              >
                Bypass 🔑
              </button>
            </div>

            {activeTab === 'google' ? (
              <Button onClick={handleLogin} disabled={isLoggingIn} size="lg" className="w-full h-16 text-lg">
                {isLoggingIn ? <RefreshCw className="animate-spin mr-2" /> : <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6 mr-3 bg-white p-1 rounded" />}
                {isLoggingIn ? 'Connecting...' : 'Continue with Google'}
              </Button>
            ) : (
              <form onSubmit={handleBypassLogin} className="space-y-4 text-left">
                <Input label="Email" type="email" value={bypassEmail} onChange={(e) => setBypassEmail(e.target.value)} required placeholder="name@gmail.com" />
                <Input label="Passcode" type="password" value={bypassCode} onChange={(e) => setBypassCode(e.target.value)} required placeholder="••••••••" />
                {bypassError && <p className="text-xs text-one-red font-bold text-center">{bypassError}</p>}
                <Button type="submit" disabled={isLoggingIn} className="w-full h-16 text-lg mt-4">
                  {isLoggingIn ? <RefreshCw className="animate-spin" /> : 'Enter Portal'}
                </Button>
              </form>
            )}

            <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] pt-4 leading-relaxed">
              *Standard OAuth. If blocked, use the <strong>Bypass</strong> tab with your account passcode.
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}

function SidebarItem({ active, icon, label, onClick }: { active?: boolean, icon: React.ReactNode, label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`
        w-full flex items-center gap-4 px-5 py-4 rounded-2xl font-bold text-sm transition-all text-left
        ${active ? 'bg-one-blue text-white shadow-lg shadow-one-blue/20' : 'text-white/50 hover:bg-white/10 hover:text-white'}
      `}
    >
      <span className={active ? 'text-white' : 'text-white/30'}>{icon}</span>
      {label}
    </button>
  );
}
