import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import QRCode from 'react-qr-code';
import {
  Wallet, Leaf, CheckCircle, CreditCard,
  LogOut, Home, Store, Plus, User, Loader2, X,
  TrendingUp, Package, Scale,
  Clock, MapPin, Truck, ShieldCheck, AlertCircle, Search,
  ChevronRight, MessageSquare, Bell, ArrowDown, ArrowUp, Lock,
  SlidersHorizontal, Filter, Edit2, Save, Camera, ArrowUpDown,
  ScanLine, QrCode, Send, Mail, HelpCircle, ShoppingBag, Megaphone,
  List, Handshake, XCircle, Gavel, Info, AlertTriangle, Star, History,
  Sparkles, MousePointerClick, Phone
} from 'lucide-react';

// Initialize Supabase Client
const supabase = createClient(
  'https://riltljeipcaplvwtejaj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpbHRsamVpcGNhcGx2d3RlamFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2MTAzMzcsImV4cCI6MjA4MDE4NjMzN30.StgCRcE7brtSvTARLsfmWHXNQvPcyRl8WiPUNuY9v0Y',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);

// Types
interface Transaction {
  id: string;
  created_at: string;
  title: string;
  amount: number;
  description: string;
  status: 'listed' | 'offer_made' | 'pending_deposit' | 'in_escrow' | 'shipped' | 'delivered' | 'completed' | 'disputed';
  vendor_id?: string;
  farmer_id?: string;
  vendor_email?: string;
  farmer_email?: string;
  delivery_pin?: string;
  category?: string;
  rating?: number;
  review?: string;
}

interface Wallet {
  user_id: string;
  balance: number;
}

// SQL Setup Component
const SetupRequired = () => {
  const [copied, setCopied] = useState(false);
  
  const sql = `
-- 1. Create Wallets Table
create table if not exists public.wallets (
  user_id uuid references auth.users(id) primary key,
  balance numeric default 0,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. Create Escrow Transactions Table
create table if not exists public.escrow_transactions (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  title text not null,
  amount numeric not null,
  description text,
  status text not null default 'pending_deposit',
  vendor_id uuid references auth.users(id),
  farmer_id uuid references auth.users(id),
  vendor_email text,
  farmer_email text,
  delivery_pin text default substring(md5(random()::text) from 0 for 7),
  category text default 'General',
  rating numeric,
  review text
);

-- 3. Create Messages Table
create table if not exists public.messages (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  transaction_id uuid references public.escrow_transactions(id) not null,
  sender_id uuid references auth.users(id) not null,
  content text not null,
  sender_email text
);

-- 4. Enable RLS
alter table public.wallets enable row level security;
alter table public.escrow_transactions enable row level security;
alter table public.messages enable row level security;

-- 5. Policies
drop policy if exists "Access own wallet" on public.wallets;
create policy "Access own wallet" on public.wallets for all using (auth.uid() = user_id);

drop policy if exists "View transactions" on public.escrow_transactions;
create policy "View transactions" on public.escrow_transactions for select
using (vendor_id = auth.uid() or farmer_id = auth.uid() or status = 'listed');

drop policy if exists "Insert transactions" on public.escrow_transactions;
create policy "Insert transactions" on public.escrow_transactions for insert
with check ((vendor_id = auth.uid()) or (farmer_id = auth.uid()));

drop policy if exists "Update transactions" on public.escrow_transactions;
create policy "Update transactions" on public.escrow_transactions for update
using (
  vendor_id = auth.uid() or farmer_id = auth.uid() or 
  (status = 'listed' and vendor_id is null) or 
  (status = 'listed' and farmer_id is null)
);

drop policy if exists "Access messages" on public.messages;
create policy "Access messages" on public.messages for all using (
  exists (select 1 from public.escrow_transactions t where t.id = transaction_id and (t.vendor_id = auth.uid() or t.farmer_id = auth.uid()))
);
`;

  const copySql = () => {
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto mt-10">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 shadow-sm">
        <h2 className="text-xl font-bold text-amber-800 flex items-center gap-2 mb-4">
          <ShieldCheck className="w-6 h-6" />
          System Update Required
        </h2>
        <p className="text-amber-700 mb-4 text-sm leading-relaxed">
          Please run this SQL in your Supabase dashboard to enable the Market visibility, ratings, and secure transaction features.
        </p>
        <div className="relative group">
          <pre className="bg-slate-900 text-slate-50 p-4 rounded-lg text-xs overflow-auto h-64 border border-slate-700 font-mono">{sql}</pre>
          <button 
            onClick={copySql}
            className="absolute top-2 right-2 bg-slate-700 hover:bg-slate-600 text-white p-2 rounded-md transition flex items-center gap-1 text-xs font-bold"
          >
            {copied ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Save className="w-4 h-4" />}
            {copied ? "Copied!" : "Copy SQL"}
          </button>
        </div>
        <button onClick={() => window.location.reload()} className="mt-6 w-full bg-amber-600 text-white py-3 rounded-lg font-semibold hover:bg-amber-700 transition shadow-md active:scale-[0.98]">
          I've Run the SQL - Reload App
        </button>
      </div>
    </div>
  );
};

// Notification Toast
const Notification = ({ message, type, onClose }: { message: string, type: 'success' | 'error' | 'info', onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(() => { onClose() }, 6000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const styles = {
    success: 'bg-emerald-900 text-emerald-50 border-emerald-700/50',
    error: 'bg-red-900 text-red-50 border-red-700/50',
    info: 'bg-blue-900 text-blue-50 border-blue-700/50'
  };

  const icons = {
    success: <CheckCircle className="w-5 h-5" />,
    error: <AlertCircle className="w-5 h-5" />,
    info: <HelpCircle className="w-5 h-5" />
  };

  const iconBg = {
    success: 'bg-emerald-800',
    error: 'bg-red-800',
    info: 'bg-blue-800'
  };

  return (
    <div className={`fixed top-4 left-4 right-4 z-[100] flex items-center gap-3 p-4 rounded-xl shadow-2xl transition-all duration-500 animate-[slideIn_0.3s_ease-out] border ${styles[type]}`}>
      <div className={`p-2 rounded-full shrink-0 ${iconBg[type]}`}>
        {icons[type]}
      </div>
      <div className="flex-1">
        <h4 className="font-bold text-sm mb-0.5 capitalize">{type}</h4>
        <p className="text-xs font-medium opacity-90 leading-relaxed">{message}</p>
      </div>
      <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition shrink-0">
        <X className="w-5 h-5 opacity-50" />
      </button>
    </div>
  );
};

// Tour Component
const Tour = ({ steps, currentStep, onNext, onClose }: { steps: any[], currentStep: number, onNext: () => void, onClose: () => void }) => {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const step = steps[currentStep];

  useEffect(() => {
    // Small delay to allow for view transitions/animations to finish
    const timer = setTimeout(() => {
      const el = document.querySelector(step.target);
      if (el) {
        const rect = el.getBoundingClientRect();
        setTargetRect(rect);
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      }
    }, 400); // 400ms delay to wait for route/tab animation

    const handleResize = () => {
      const el = document.querySelector(step.target);
      if(el) setTargetRect(el.getBoundingClientRect());
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
    };
  }, [currentStep, step.target]);

  if (!targetRect) return null;

  // Calculate tooltip position
  const isTop = targetRect.top > 300;
  const tooltipTop = isTop ? targetRect.top - 180 : targetRect.bottom + 20;
  
  return (
    <div className="fixed inset-0 z-[100] overflow-hidden">
      {/* Background Mask using box-shadow trick to create a 'hole' */}
      <div 
        className="absolute transition-all duration-500 ease-in-out border-2 border-emerald-400 rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.85)]"
        style={{
          top: targetRect.top - 8,
          left: targetRect.left - 8,
          width: targetRect.width + 16,
          height: targetRect.height + 16,
        }}
      >
        {/* Pulse effect around the hole */}
        <div className="absolute inset-0 -m-1 rounded-xl animate-ping border border-emerald-500/50" />
        
        {/* Pointer/Icon floating near the target */}
        <div className={`absolute left-1/2 -translate-x-1/2 ${isTop ? '-bottom-12' : '-top-12'} text-white animate-bounce`}>
          {isTop ? <ArrowUp className="w-8 h-8" /> : <ArrowDown className="w-8 h-8" />}
        </div>
      </div>

      {/* Tooltip Card */}
      <div 
        className="absolute w-72 bg-white p-5 rounded-2xl shadow-2xl animate-in fade-in zoom-in duration-300 flex flex-col gap-3"
        style={{
          top: tooltipTop,
          left: Math.max(16, Math.min(window.innerWidth - 304, targetRect.left + targetRect.width / 2 - 144))
        }}
      >
        <div className="flex justify-between items-center pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full">STEP {currentStep + 1}/{steps.length}</span>
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-slate-500 transition">
            <X className="w-4 h-4"/>
          </button>
        </div>
        
        <div>
          <h3 className="font-bold text-slate-800 text-lg leading-tight mb-1">{step.title}</h3>
          <p className="text-sm text-slate-500 leading-relaxed">{step.content}</p>
        </div>

        <div className="flex justify-between items-center pt-2 mt-auto">
           <button onClick={onClose} className="text-xs font-bold text-slate-400 hover:text-slate-600 px-2 py-1">Skip Tour</button>
           <button 
             onClick={onNext} 
             className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg hover:bg-emerald-600 transition flex items-center gap-2"
           >
             {currentStep === steps.length - 1 ? "Finish" : "Next"}
             <ChevronRight className="w-4 h-4" />
           </button>
        </div>
      </div>
    </div>
  );
};

// Login/Signup Component
const Login = ({ onLogin }: { onLogin: () => void }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'farmer' | 'vendor'>('vendor');
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setNotification(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { role },
            emailRedirectTo: window.location.origin
          }
        });
        if (error) throw error;
        if (data.user && !data.session) {
          setNotification({ message: "Account created! Check email to verify.", type: "success" });
          setIsLogin(true);
          setLoading(false);
          return;
        }
      }
      onLogin();
    } catch (err: any) {
      setNotification({ message: err.message, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 relative">
      {notification && <Notification {...notification} onClose={() => setNotification(null)} />}
      
      <div className="bg-white w-full max-w-md p-8 rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-100 relative overflow-hidden">
        {/* Background shapes */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-bl-full -z-0 opacity-50" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-emerald-50 rounded-tr-full -z-0 opacity-50" />

        <div className="flex flex-col items-center mb-8 relative z-10">
          <div className="w-20 h-20 bg-emerald-50 rounded-2xl flex items-center justify-center mb-5 shadow-sm border border-emerald-100 transform rotate-3 hover:rotate-0 transition duration-300 group">
            <div className="relative">
              <Leaf className="w-10 h-10 text-emerald-600 absolute -top-1 -left-1 opacity-20 group-hover:scale-110 transition" />
              <Leaf className="w-10 h-10 text-emerald-700 relative z-10" />
            </div>
          </div>
          <h1 className="text-3xl font-extrabold text-emerald-950 tracking-tight text-center">Mkulima Express</h1>
          <p className="text-slate-500 text-center mt-2 font-medium text-sm">Trusted Escrow for Farmers & Vendors</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-5 relative z-10">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">Email Address</label>
            <div className="relative">
              <input
                type="email"
                required
                className="w-full p-4 pl-12 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition font-medium text-slate-800"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
              <User className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">Password</label>
            <div className="relative">
              <input
                type="password"
                required
                className="w-full p-4 pl-12 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition font-medium text-slate-800"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
              <Lock className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {!isLogin && (
            <div className="grid grid-cols-2 gap-4 mt-2 animate-in slide-in-from-top-2 duration-300">
              <button
                type="button"
                onClick={() => setRole('vendor')}
                className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition duration-200 active:scale-95 ${role === 'vendor' ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-500' : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'}`}
              >
                <Store className="w-6 h-6" />
                <span className="text-sm font-bold">Vendor</span>
              </button>
              <button
                type="button"
                onClick={() => setRole('farmer')}
                className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition duration-200 active:scale-95 ${role === 'farmer' ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-500' : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'}`}
              >
                <Leaf className="w-6 h-6" />
                <span className="text-sm font-bold">Farmer</span>
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-700 hover:bg-emerald-800 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-emerald-700/30 transition active:scale-[0.98] mt-4 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (isLogin ? "Sign In" : "Create Account")}
            {!loading && <ChevronRight className="w-5 h-5" />}
          </button>
        </form>

        <p className="text-center mt-8 text-slate-500 text-sm relative z-10">
          {isLogin ? "New to Mkulima Express? " : "Already have an account? "}
          <button onClick={() => { setIsLogin(!isLogin); setNotification(null); }} className="text-emerald-700 font-bold hover:underline transition">
            {isLogin ? "Create Account" : "Log In"}
          </button>
        </p>
      </div>
    </div>
  );
};

// Status Badge Component
const StatusBadge = ({ status }: { status: string }) => {
  const styles: any = {
    listed: 'bg-slate-100 text-slate-700 border-slate-200',
    offer_made: 'bg-purple-50 text-purple-700 border-purple-200',
    pending_deposit: 'bg-amber-50 text-amber-700 border-amber-200',
    in_escrow: 'bg-blue-50 text-blue-700 border-blue-200',
    shipped: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    delivered: 'bg-teal-50 text-teal-700 border-teal-200',
    completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    disputed: 'bg-red-50 text-red-700 border-red-200'
  };

  const labels: any = {
    listed: 'Market Listed',
    offer_made: 'Offer Received',
    pending_deposit: 'Awaiting Deposit',
    in_escrow: 'Secure in Escrow',
    shipped: 'On The Way',
    delivered: 'Delivered',
    completed: 'Transaction Complete',
    disputed: 'Under Dispute'
  };

  return (
    <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${styles[status]}`}>
      {labels[status]}
    </span>
  );
};

// Loading Screen Component
const LoadingScreen = () => (
  <div className="flex items-center justify-center min-h-screen bg-slate-50">
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <div className="absolute inset-0 bg-emerald-200 rounded-full animate-ping opacity-75" />
        <div className="relative bg-white p-3 rounded-full shadow-lg">
          <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
        </div>
      </div>
      <p className="text-slate-500 text-sm font-medium tracking-wide">Connecting to Mkulima Express...</p>
    </div>
  </div>
);

// Main App Component
const App = () => {
  const [session, setSession] = useState<any>(null);
  const [role, setRole] = useState<'farmer' | 'vendor'>('vendor');
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [view, setView] = useState('dashboard');
  const [setupRequired, setSetupRequired] = useState(false);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState('All');
  
  // Profile State
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileLocation, setProfileLocation] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profileErrors, setProfileErrors] = useState<any>({});
  
  // Tour State
  const [tourStepIndex, setTourStepIndex] = useState(-1);

  // Create Form State
  const [newTitle, setNewTitle] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCategory, setNewCategory] = useState('Vegetables');

  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);

  const marketTrends = [
    { name: 'Maize (90kg)', price: 5500, change: 2.4, up: true },
    { name: 'Red Onions', price: 120, change: 5.1, up: true },
    { name: 'Tomatoes', price: 95, change: 1.2, up: false },
    { name: 'Potatoes', price: 80, change: 0.5, up: true },
    { name: 'Cabbage', price: 40, change: 3.0, up: false },
    { name: 'Beans', price: 140, change: 1.8, up: true },
    { name: 'Eggs (Tray)', price: 450, change: 0.8, up: true },
    { name: 'Watermelon', price: 200, change: 4.2, up: false },
    { name: 'Carrots', price: 65, change: 1.5, up: true },
    { name: 'Kales', price: 30, change: 0.5, up: false },
  ];

  const tourSteps = [
    { target: '#wallet-card', title: 'Smart Wallet', content: 'Check your balance, top up via M-Pesa, and see your earnings. Funds are held safely here during transactions.', view: 'dashboard' },
    { target: '#nav-market', title: 'The Marketplace', content: 'Browse listings to buy produce or fulfill requests from other users.', view: 'market' },
    { target: '#nav-create', title: 'Create Listing', content: 'Farmers can list produce for sale, and Vendors can post buying requests.', view: 'create' },
    { target: '#nav-wallet', title: 'Transaction History', content: 'Track every deposit, escrow hold, and payout in your wallet history.', view: 'wallet' },
    { target: '#nav-home', title: 'Home Dashboard', content: 'Return here anytime to see your active orders and quick status updates.', view: 'dashboard' }
  ];

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error && error.message.includes('Refresh Token')) {
        supabase.auth.signOut();
        setSession(null);
        setLoading(false);
        return;
      }
      setSession(session);
      if (session) {
        const meta = session.user.user_metadata;
        setRole(meta.role || 'vendor');
        setProfileName(meta.full_name || '');
        setProfilePhone(meta.phone || '');
        setProfileLocation(meta.location || '');
        setProfileEmail(session.user.email || '');
        
        fetchTransactions();
        fetchWallet(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        const meta = session.user.user_metadata;
        setRole(meta.role || 'vendor');
        setProfileName(meta.full_name || '');
        setProfilePhone(meta.phone || '');
        setProfileLocation(meta.location || '');
        setProfileEmail(session.user.email || '');

        fetchTransactions();
        fetchWallet(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Real-time subscriptions
  useEffect(() => {
    if (!session) return;

    // Listen for new messages
    const msgSub = supabase
      .channel('msg-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
        const msg = payload.new as any;
        if (msg.sender_id === session.user.id) return; // Don't notify own messages
        
        // Fetch transaction details to show title
        const { data: tx } = await supabase.from('escrow_transactions').select('title, farmer_id, vendor_id').eq('id', msg.transaction_id).single();
        if (tx && (tx.farmer_id === session.user.id || tx.vendor_id === session.user.id)) {
          setNotification({ message: `New message in "${tx.title}"`, type: 'info' });
        }
      })
      .subscribe();

    // Listen for transaction status changes
    const txSub = supabase
      .channel('tx-notifications')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'escrow_transactions' }, (payload) => {
        const newTx = payload.new as Transaction;
        const oldTx = payload.old as Transaction;
        
        if (newTx.status === oldTx.status) return;

        const isFarmer = newTx.farmer_id === session.user.id;
        const isVendor = newTx.vendor_id === session.user.id;

        if (!isFarmer && !isVendor) return;

        let msg = '';
        if (newTx.status === 'offer_made' && isFarmer) msg = `New Offer: Vendor wants "${newTx.title}"`;
        else if (newTx.status === 'pending_deposit' && isVendor) msg = `Offer Accepted: Please fund "${newTx.title}"`;
        else if (newTx.status === 'in_escrow' && isFarmer) msg = `Funded: Safe to ship "${newTx.title}"`;
        else if (newTx.status === 'shipped' && isVendor) msg = `Shipped: "${newTx.title}" is on the way!`;
        else if (newTx.status === 'delivered') msg = `Delivered: "${newTx.title}" has arrived.`;
        else if (newTx.status === 'completed' && isFarmer) msg = `Paid: Funds released for "${newTx.title}"`;
        else if (newTx.status === 'disputed') msg = `Alert: Dispute raised for "${newTx.title}"`;

        if (msg) {
          setNotification({ message: msg, type: newTx.status === 'disputed' ? 'error' : 'success' });
          fetchTransactions(); // Refresh list
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(msgSub);
      supabase.removeChannel(txSub);
    };
  }, [session]);

  const fetchTransactions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('escrow_transactions')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      if (error.code === '42P01') { // Undefined table
        setSetupRequired(true);
      } else {
        console.error(error);
      }
    } else {
      setTransactions(data || []);
    }
    setLoading(false);
  };

  const fetchWallet = async (userId: string) => {
    const { data, error } = await supabase.from('wallets').select('*').eq('user_id', userId).single();
    if (error && error.code === 'PGRST116') {
      // Create wallet if not exists
      const { data: newWallet, error: createError } = await supabase
        .from('wallets')
        .insert([{ user_id: userId, balance: 0 }])
        .select()
        .single();
      if (newWallet) setWallet(newWallet);
    } else if (data) {
      setWallet(data);
    }
  };

  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;

    const isVendor = role === 'vendor';
    const { error } = await supabase.from('escrow_transactions').insert({
      title: newTitle,
      amount: parseFloat(newAmount),
      description: newDesc,
      category: newCategory,
      vendor_id: isVendor ? session.user.id : null,
      farmer_id: isVendor ? null : session.user.id,
      vendor_email: isVendor ? session.user.email : null,
      farmer_email: isVendor ? null : session.user.email,
      status: 'listed'
    });

    if (error) {
      setNotification({ message: "Error creating transaction. Please try again.", type: "error" });
    } else {
      setNewTitle('');
      setNewAmount('');
      setNewDesc('');
      setView('dashboard');
      fetchTransactions();
      setNotification({ message: "Listed successfully on the market!", type: "success" });
    }
  };

  const validateProfile = () => {
    const errors: any = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!profileName.trim()) errors.name = "Full name is required";
    if (!emailRegex.test(profileEmail)) errors.email = "Invalid email address format";
    if (profilePhone.replace(/\D/g, '').length < 10) errors.phone = "Phone number must be at least 10 digits";
    if (!profileLocation.trim()) errors.location = "Location is required";

    setProfileErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveProfile = async () => {
    if (!validateProfile()) {
        setNotification({ message: "Please fix the errors in the form.", type: "error" });
        return;
    }

    setLoading(true);
    const attributes: any = {
        data: {
            full_name: profileName,
            phone: profilePhone,
            location: profileLocation
        }
    };
    if (profileEmail !== session.user.email) {
        attributes.email = profileEmail;
    }

    const { error } = await supabase.auth.updateUser(attributes);

    setLoading(false);

    if (error) {
        setNotification({ message: error.message, type: "error" });
    } else {
        setNotification({ message: "Profile updated successfully!", type: "success" });
        if (profileEmail !== session.user.email) {
             setNotification({ message: "Check your new email for a verification link.", type: "info" });
        }
        setView('dashboard');
    }
  };

  const handleMakeOffer = async (txId: string) => {
    if (!session || role !== 'vendor') return;
    const { error } = await supabase
      .from('escrow_transactions')
      .update({ 
        vendor_id: session.user.id,
        vendor_email: session.user.email,
        status: 'offer_made'
      })
      .eq('id', txId)
      .eq('status', 'listed')
      .is('vendor_id', null);

    if (error) {
      setNotification({ message: "Could not make offer. It may have been taken.", type: "error" });
    } else {
      fetchTransactions();
      setSelectedTxId(txId);
      setNotification({ message: "Offer sent to Farmer!", type: "success" });
    }
  };

  const handleFulfillRequest = async (txId: string) => {
    if (!session || role !== 'farmer') return;
    const { error } = await supabase
      .from('escrow_transactions')
      .update({ 
        farmer_id: session.user.id,
        farmer_email: session.user.email,
        status: 'pending_deposit'
      })
      .eq('id', txId)
      .eq('status', 'listed')
      .is('farmer_id', null);

    if (error) {
      setNotification({ message: "Could not fulfill request. It may have been taken.", type: "error" });
    } else {
      fetchTransactions();
      setSelectedTxId(txId);
      setNotification({ message: "Order fulfilled! Waiting for deposit.", type: "success" });
    }
  };

  const simulateMpesa = async () => {
    if (!session) return;
    const amount = 5000;
    const phone = prompt("Enter your M-Pesa phone number (e.g. 2547XXXXXXXX):");
    
    if (phone) {
      try {
        const response = await fetch('http://localhost:4000/mpesa/stk-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount,
            phoneNumber: phone,
            accountReference: `WALLET_${session.user.id}`,
            description: 'Mkulima Express wallet top up'
          })
        });
        
        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data?.error?.errorMessage || "Failed to initiate M-Pesa payment");
        }
        setNotification({ message: "STK Push sent. Check your phone to approve payment.", type: "info" });
      } catch (e: any) {
        setNotification({ message: e.message || "Error starting M-Pesa payment", type: "error" });
      }
    }
  };

  const selectedTransaction = useMemo(() => 
    transactions.find(t => t.id === selectedTxId), 
  [transactions, selectedTxId]);

  if (loading) return <LoadingScreen />;
  if (setupRequired) return <SetupRequired />;
  if (!session) return <Login onLogin={() => {}} />;

  const TransactionDetail = ({ transaction: t, onClose }: { transaction: Transaction, onClose: () => void }) => {
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState<any[]>([]);
    const [tab, setTab] = useState<'info' | 'chat' | 'logistics'>('info');
    const chatEndRef = useRef<HTMLDivElement>(null);
    const [showScanner, setShowScanner] = useState(false);
    const [pinInput, setPinInput] = useState('');
    const [rating, setRating] = useState(0);
    const [review, setReview] = useState('');
    const [submittingRating, setSubmittingRating] = useState(false);

    useEffect(() => {
      // Load existing messages
      (async () => {
        const { data } = await supabase
          .from('messages')
          .select('*')
          .eq('transaction_id', t.id)
          .order('created_at', { ascending: true });
        setMessages(data || []);
      })();

      // Subscribe to new messages
      const sub = supabase
        .channel('msgs')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `transaction_id=eq.${t.id}`}, (payload) => {
          setMessages(prev => [...prev, payload.new]);
        })
        .subscribe();

      return () => { supabase.removeChannel(sub); };
    }, [t.id]);

    useEffect(() => {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, tab]);

    const sendMessage = async () => {
      if (!message.trim()) return;
      await supabase.from('messages').insert({
        transaction_id: t.id,
        sender_id: session.user.id,
        sender_email: session.user.email,
        content: message
      });
      setMessage('');
    };

    const updateStatus = async (newStatus: string, cancel: boolean = false) => {
      // Logic for fund movements would go here in a real app (using RLS functions)
      if (newStatus === 'in_escrow' && t.status === 'pending_deposit') {
        if (!wallet || wallet.balance < t.amount) {
          setNotification({ message: "Insufficient funds in wallet! Please top up.", type: "error" });
          return;
        }
        // Deduct from wallet (simplified client-side logic for demo - secure apps use Postgres functions)
        await supabase.from('wallets').update({ balance: wallet.balance - t.amount }).eq('user_id', session.user.id);
      }

      if (newStatus === 'completed' && t.status === 'delivered' && t.farmer_id) {
        // Release funds
        const { data: farmerWallet } = await supabase.from('wallets').select('balance').eq('user_id', t.farmer_id).single();
        if (farmerWallet) {
          await supabase.from('wallets').update({ balance: farmerWallet.balance + t.amount }).eq('user_id', t.farmer_id);
        }
      }

      const updates: any = { status: newStatus };
      if (cancel) {
        updates.vendor_id = null;
        updates.vendor_email = null;
      }

      const { error } = await supabase.from('escrow_transactions').update(updates).eq('id', t.id);
      
      if (error) {
        setNotification({ message: "Failed to update status", type: "error" });
      } else {
        fetchTransactions();
        fetchWallet(session.user.id);
        
        let successMessage = "Transaction updated successfully";
        if (cancel) {
            successMessage = "Offer rejected successfully";
        } else {
            const statusMessages: Record<string, string> = {
                'pending_deposit': "Offer Accepted! Waiting for deposit.",
                'in_escrow': "Funds securely deposited to Escrow.",
                'shipped': "Item marked as Shipped. Buyer notified.",
                'delivered': "Delivery verified successfully!",
                'completed': "Transaction completed. Funds released to Farmer.",
                'disputed': "Dispute raised. Support team notified."
            };
            if (statusMessages[newStatus]) {
                successMessage = statusMessages[newStatus];
            }
        }

        setNotification({ 
            message: successMessage, 
            type: newStatus === 'disputed' ? 'error' : 'success' 
        });

        if (newStatus === 'completed' || cancel) {
          if(cancel) onClose();
        }
      }
    };

    const verifyDelivery = () => {
      if (pinInput === t.delivery_pin) {
        updateStatus('delivered');
      } else {
        setNotification({ message: "Invalid PIN code", type: "error" });
      }
    };

    const submitRating = async () => {
      if (rating === 0) return;
      setSubmittingRating(true);
      const { error } = await supabase.from('escrow_transactions').update({ rating, review }).eq('id', t.id);
      if (error) {
        setNotification({ message: "Failed to save rating.", type: "error" });
      } else {
        setNotification({ message: "Rating submitted!", type: "success" });
        onClose();
      }
      setSubmittingRating(false);
    };

    const isFarmer = session.user.id === t.farmer_id;
    const isVendor = session.user.id === t.vendor_id;
    const isParticipant = isFarmer || isVendor;

    return (
      <div className="fixed inset-0 bg-slate-50 z-50 flex flex-col animate-in slide-in-from-bottom-10 duration-200">
        <div className="bg-white px-4 py-4 border-b flex items-center gap-3 sticky top-0 z-10 shadow-sm">
          <button onClick={onClose} className="p-2 -ml-2 hover:bg-slate-100 rounded-full">
            <ChevronRight className="w-6 h-6 rotate-180 text-slate-600" />
          </button>
          <div className="flex-1">
            <h2 className="font-bold text-slate-800 text-lg leading-tight">{t.title}</h2>
            <p className="text-xs text-slate-500 font-mono">ID: {t.id.slice(0, 8)}</p>
          </div>
          <StatusBadge status={t.status} />
        </div>

        <div className="flex bg-white border-b">
          <button onClick={() => setTab('info')} className={`flex-1 py-3 text-sm font-semibold border-b-2 transition ${tab === 'info' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-400'}`}>Details</button>
          <button onClick={() => setTab('chat')} className={`flex-1 py-3 text-sm font-semibold border-b-2 transition ${tab === 'chat' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-400'}`}>Chat</button>
          <button onClick={() => setTab('logistics')} className={`flex-1 py-3 text-sm font-semibold border-b-2 transition ${tab === 'logistics' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-400'}`}>Logistics</button>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50 p-4">
          {tab === 'info' && (
            <div className="space-y-6">
              <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Amount</span>
                    <div className="text-3xl font-mono font-bold text-emerald-700 mt-1">KES {t.amount.toLocaleString()}</div>
                  </div>
                  {t.category && <span className="bg-slate-100 text-slate-600 text-[10px] px-2 py-1 rounded-full font-bold uppercase">{t.category}</span>}
                </div>
                
                <div className="mt-4 pt-4 border-t border-slate-50">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Description</span>
                  <p className="text-slate-700 leading-relaxed">{t.description || "No description provided."}</p>
                </div>

                <div className="mt-4 flex gap-2">
                  {isFarmer && <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-1 rounded-full font-bold">You are the Farmer</span>}
                  {isVendor && <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-bold">You are the Vendor</span>}
                  {!isFarmer && !isVendor && <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded-full font-bold">Read Only View</span>}
                </div>
              </div>

              {t.status === 'completed' && !t.rating && isParticipant && (
                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 animate-in fade-in">
                  <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                    <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                    Rate this Transaction
                  </h3>
                  <p className="text-sm text-slate-500 mb-4">How was your experience with the other party?</p>
                  <div className="flex justify-center gap-2 mb-4">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button key={star} onClick={() => setRating(star)} className="focus:outline-none transition transform hover:scale-110">
                        <Star className={`w-8 h-8 ${rating >= star ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} />
                      </button>
                    ))}
                  </div>
                  <textarea 
                    className="w-full p-3 bg-slate-50 rounded-lg text-sm border border-slate-200 mb-3"
                    placeholder="Optional review..."
                    rows={2}
                    value={review}
                    onChange={(e) => setReview(e.target.value)}
                  />
                  <button 
                    onClick={submitRating} 
                    disabled={submittingRating || rating === 0}
                    className="w-full bg-slate-800 text-white py-2 rounded-lg font-bold text-sm disabled:opacity-50"
                  >
                    {submittingRating ? 'Submitting...' : 'Submit Rating'}
                  </button>
                </div>
              )}

              {t.status === 'disputed' && (
                <div className="bg-red-50 p-5 rounded-xl border border-red-200 flex items-start gap-3">
                  <AlertTriangle className="w-6 h-6 text-red-600 shrink-0" />
                  <div>
                    <h3 className="font-bold text-red-800 text-sm">Transaction Disputed</h3>
                    <p className="text-xs text-red-700 mt-1">An admin has been notified. Please use the chat to resolve the issue or wait for mediation.</p>
                  </div>
                </div>
              )}

              <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-600" />
                  Progress
                </h3>
                <div className="space-y-6 relative pl-2">
                  <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-slate-100" />
                  {[
                    { s: 'listed', l: 'Listed on Market', done: true },
                    { s: 'offer_made', l: 'Offer Received', done: t.status !== 'listed' },
                    { s: 'pending_deposit', l: 'Contract Formed', done: ['pending_deposit', 'in_escrow', 'shipped', 'delivered', 'completed'].includes(t.status) },
                    { s: 'in_escrow', l: 'Funds Secured', done: ['in_escrow', 'shipped', 'delivered', 'completed'].includes(t.status) },
                    { s: 'shipped', l: 'Goods Shipped', done: ['shipped', 'delivered', 'completed'].includes(t.status) },
                    { s: 'delivered', l: 'Delivered', done: ['delivered', 'completed'].includes(t.status) },
                    { s: 'completed', l: 'Funds Released', done: t.status === 'completed' }
                  ].map((step, i) => (
                    <div key={i} className="relative flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center relative z-10 bg-white ${step.done ? 'border-emerald-500 text-emerald-500' : 'border-slate-200 text-slate-300'}`}>
                        {step.done ? <CheckCircle className="w-4 h-4" /> : <div className="w-2 h-2 rounded-full bg-slate-200" />}
                      </div>
                      <span className={`text-sm font-medium ${step.done ? 'text-slate-800' : 'text-slate-400'}`}>{step.l}</span>
                    </div>
                  ))}
                </div>
              </div>

              {isParticipant && (
                <div className="pb-8">
                  {isFarmer && t.status === 'offer_made' && (
                    <div className="space-y-3">
                      <div className="bg-purple-50 p-4 rounded-xl border border-purple-200 mb-2">
                        <p className="text-sm text-purple-800 font-medium text-center">
                          A Vendor wants to buy this for <span className="font-bold">KES {t.amount.toLocaleString()}</span>.
                        </p>
                      </div>
                      <button onClick={() => updateStatus('pending_deposit')} className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 active:scale-95 transition flex items-center justify-center gap-2">
                        <Handshake className="w-5 h-5" /> Accept Offer
                      </button>
                      <button onClick={() => updateStatus('listed', true)} className="w-full bg-white text-slate-600 border border-slate-200 py-3 rounded-xl font-bold hover:bg-slate-50 active:scale-95 transition flex items-center justify-center gap-2">
                        <XCircle className="w-5 h-5" /> Reject Offer
                      </button>
                    </div>
                  )}

                  {isVendor && t.status === 'offer_made' && (
                    <div className="bg-amber-50 p-4 rounded-xl text-amber-800 text-sm font-medium text-center border border-amber-200">
                      Waiting for Farmer to accept your offer.
                    </div>
                  )}

                  {isVendor && t.status === 'pending_deposit' && (
                    <button onClick={() => updateStatus('in_escrow')} className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 active:scale-95 transition flex items-center justify-center gap-2">
                      <Lock className="w-5 h-5" /> Deposit Funds (Escrow)
                    </button>
                  )}

                  {isFarmer && t.status === 'pending_deposit' && (
                    <div className="bg-blue-50 p-4 rounded-xl text-blue-800 text-sm font-medium text-center border border-blue-200">
                      Waiting for Vendor to deposit funds.
                    </div>
                  )}

                  {isFarmer && t.status === 'in_escrow' && (
                    <button onClick={() => updateStatus('shipped')} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition flex items-center justify-center gap-2">
                      <Truck className="w-5 h-5" /> Mark as Shipped
                    </button>
                  )}

                  {isVendor && t.status === 'delivered' && (
                    <button onClick={() => updateStatus('completed')} className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 active:scale-95 transition flex items-center justify-center gap-2">
                      <CheckCircle className="w-5 h-5" /> Release Payment
                    </button>
                  )}

                  {t.status !== 'completed' && t.status !== 'disputed' && t.status !== 'listed' && (
                    <button onClick={() => updateStatus('disputed')} className="mt-4 w-full bg-white text-red-600 border border-red-100 py-3 rounded-xl font-semibold hover:bg-red-50 transition flex items-center justify-center gap-2">
                      <Gavel className="w-4 h-4" /> Raise Dispute
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {tab === 'chat' && (
            <div className="flex flex-col h-full">
              <div className="flex-1 space-y-4 mb-4" ref={chatEndRef}>
                {messages.length === 0 && (
                  <div className="text-center text-slate-400 mt-10 text-sm">No messages yet. Start discussing!</div>
                )}
                {messages.map(m => {
                  const isMe = m.sender_id === session.user.id;
                  return (
                    <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${isMe ? 'bg-emerald-600 text-white rounded-tr-none' : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none'}`}>
                        {m.content}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-2 bg-white p-2 rounded-full border border-slate-200 shadow-sm">
                <input 
                  className="flex-1 bg-transparent px-4 py-2 outline-none text-sm" 
                  placeholder="Type a message..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
                <button onClick={sendMessage} className="p-2 bg-emerald-600 text-white rounded-full hover:bg-emerald-700 transition">
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {tab === 'logistics' && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-xl shadow-sm text-center border border-slate-100">
                <h3 className="font-bold text-slate-800 mb-2">Delivery Verification</h3>
                <p className="text-slate-500 text-sm mb-6">Use this QR code to securely verify delivery.</p>
                
                {isFarmer ? (
                  (t.status === 'shipped' || t.status === 'delivered') ? (
                    <div className="flex flex-col items-center">
                      <div className="bg-white p-4 rounded-xl border-2 border-slate-900 mb-4">
                        <QRCode value={t.delivery_pin || 'error'} size={180} />
                      </div>
                      <p className="text-xs font-mono text-slate-400">PIN: {t.delivery_pin}</p>
                      <p className="text-sm font-medium text-emerald-700 mt-4 bg-emerald-50 px-4 py-2 rounded-lg">Show this to Vendor upon delivery</p>
                    </div>
                  ) : (
                    <div className="p-8 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                      <Truck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm text-slate-400">QR Code generates when marked as shipped.</p>
                    </div>
                  )
                ) : isVendor ? (
                  <div className="flex flex-col items-center">
                    {showScanner ? (
                      <div className="w-full rounded-xl overflow-hidden mb-4 relative bg-black h-64">
                        <div className="absolute inset-0 flex items-center justify-center text-white text-xs">
                          <p>Camera would open here in prod.</p>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setShowScanner(true)} className="mb-6 p-6 bg-slate-50 rounded-full border-2 border-emerald-100 hover:border-emerald-500 hover:bg-emerald-50 transition group">
                        <ScanLine className="w-12 h-12 text-emerald-300 group-hover:text-emerald-600 transition" />
                      </button>
                    )}
                    
                    <div className="w-full">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Or Enter PIN</label>
                      <div className="flex gap-2">
                        <input 
                          value={pinInput}
                          onChange={(e) => setPinInput(e.target.value)}
                          placeholder="e.g. A7X29"
                          className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-center font-mono tracking-widest uppercase outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <button onClick={verifyDelivery} className="px-6 bg-slate-800 text-white rounded-xl font-bold">
                          Verify
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-slate-400 italic text-sm">Only the involved parties can access logistics.</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 shadow-2xl overflow-hidden relative pb-20">
      {notification && <Notification {...notification} onClose={() => setNotification(null)} />}
      
      <style>{`
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-ticker {
          animation: ticker 30s linear infinite;
          width: max-content;
        }
        .animate-ticker:hover {
          animation-play-state: paused;
        }
      `}</style>

      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md sticky top-0 z-30 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-100 p-2 rounded-lg">
            <Leaf className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <h1 className="font-extrabold text-emerald-950 text-lg leading-none">Mkulima Express</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{role}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setTourStepIndex(0)} className="p-2 text-emerald-600 hover:text-emerald-700 transition bg-emerald-50 rounded-full">
            <HelpCircle className="w-5 h-5" />
          </button>
          <button onClick={() => supabase.auth.signOut()} className="p-2 text-slate-400 hover:text-red-500 transition bg-slate-50 rounded-full">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="p-4 space-y-4">
        {view === 'dashboard' && (
          <div className="space-y-4 animate-in fade-in duration-500">
            {/* Wallet Card */}
            <div id="wallet-card" className="bg-gradient-to-br from-emerald-800 to-emerald-600 rounded-2xl p-6 text-white shadow-xl shadow-emerald-700/20 relative overflow-hidden">
              <div className="absolute -right-4 -bottom-4 bg-white/10 w-32 h-32 rounded-full blur-2xl" />
              <div className="relative z-10">
                <div className="flex items-center gap-2 text-emerald-200 mb-1 text-sm font-medium">
                  <Wallet className="w-4 h-4" /> Wallet Balance
                </div>
                <div className="text-3xl font-mono font-bold tracking-tight">
                  KES {wallet?.balance.toLocaleString() ?? '...'}
                </div>
                <div className="mt-4 flex gap-2">
                  <button onClick={() => setView('wallet')} className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-xs font-bold backdrop-blur-sm transition">
                    Top Up
                  </button>
                  <button className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-xs font-bold backdrop-blur-sm transition">
                    Withdraw
                  </button>
                </div>
              </div>
            </div>

            {/* Active Transactions */}
            <div>
              <div className="flex justify-between items-center mb-3 px-1">
                <h2 className="font-bold text-slate-800">Your Activity</h2>
                <span className="text-xs text-emerald-600 font-semibold cursor-pointer">View All</span>
              </div>
              
              {transactions.filter(t => t.farmer_id === session.user.id || t.vendor_id === session.user.id).length === 0 ? (
                <div className="text-center py-10 bg-white rounded-xl border border-dashed border-slate-300">
                  <Leaf className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500 text-sm">No transactions yet.</p>
                  <button onClick={() => setView('create')} className="mt-3 text-emerald-700 font-bold text-sm hover:underline">
                    Start New
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {transactions.filter(t => t.farmer_id === session.user.id || t.vendor_id === session.user.id).map(t => (
                    <div key={t.id} onClick={() => setSelectedTxId(t.id)} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4 hover:shadow-md transition cursor-pointer active:scale-[0.99]">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${t.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                        {t.status === 'completed' ? <CheckCircle className="w-6 h-6" /> : <CreditCard className="w-6 h-6" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1">
                          <h3 className="font-bold text-slate-800 truncate pr-2">{t.title}</h3>
                          <span className="text-emerald-700 font-mono font-bold text-sm whitespace-nowrap">KES {t.amount.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <p className="text-xs text-slate-400 truncate max-w-[120px]">{t.created_at.slice(0, 10)}</p>
                          <StatusBadge status={t.status} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'market' && (
          <div className="animate-in fade-in duration-500 space-y-4">
            {/* Market Trends Section */}
            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="flex justify-between items-center mb-3 px-1">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  Market Trends (Avg Price)
                </h3>
                <span className="text-[10px] text-slate-400">Live Updates</span>
              </div>
              
              <div className="relative w-full overflow-hidden" style={{ maskImage: 'linear-gradient(to right, transparent, black 5%, black 95%, transparent)', WebkitMaskImage: 'linear-gradient(to right, transparent, black 5%, black 95%, transparent)' }}>
                <div className="flex gap-3 animate-ticker w-max">
                  {[...marketTrends, ...marketTrends].map((item, i) => (
                    <div key={i} className="min-w-[140px] p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col hover:border-emerald-300 transition-colors cursor-default group">
                      <span className="text-xs font-medium text-slate-600 mb-1 truncate group-hover:text-emerald-700 transition-colors">{item.name}</span>
                      <div className="flex items-end justify-between mt-auto">
                        <span className="text-sm font-bold text-slate-800 font-mono">KES {item.price.toLocaleString()}</span>
                        <span className={`text-[10px] font-bold flex items-center ${item.up ? 'text-emerald-600' : 'text-red-500'}`}>
                          {item.up ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                          {item.change}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {['All', 'Vegetables', 'Fruits', 'Grains', 'Livestock'].map(cat => (
                <button 
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition ${activeCategory === cat ? 'bg-emerald-600 text-white shadow-emerald-200 shadow-md' : 'bg-white text-slate-500 border border-slate-200'}`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {transactions
                .filter(t => t.status === 'listed')
                .filter(t => activeCategory === 'All' || t.category === activeCategory)
                .map(t => {
                  const isRequest = !t.farmer_id && t.vendor_id;
                  const isListing = !t.vendor_id && t.farmer_id;
                  
                  return (
                    <div key={t.id} onClick={() => setSelectedTxId(t.id)} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm hover:border-emerald-500 transition cursor-pointer group flex flex-col h-full">
                      <div className={`h-24 rounded-lg mb-3 flex items-center justify-center transition relative overflow-hidden ${isRequest ? 'bg-amber-50 group-hover:bg-amber-100' : 'bg-emerald-50 group-hover:bg-emerald-100'}`}>
                        {isRequest ? <Megaphone className="w-8 h-8 text-amber-400 group-hover:text-amber-500" /> : <ShoppingBag className="w-8 h-8 text-emerald-400 group-hover:text-emerald-500" />}
                        <div className={`absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded ${isRequest ? 'bg-amber-200 text-amber-800' : 'bg-emerald-200 text-emerald-800'}`}>
                          {isRequest ? 'WANTED' : 'FOR SALE'}
                        </div>
                      </div>
                      <div className="mb-1">
                        <span className="text-[9px] uppercase font-bold text-slate-400">{t.category || 'General'}</span>
                        <h4 className="font-bold text-slate-800 text-sm truncate">{t.title}</h4>
                      </div>
                      <p className="text-emerald-700 font-mono font-bold text-sm mt-1">KES {t.amount}</p>
                      
                      <div className="mt-auto pt-3">
                        {role === 'vendor' && isListing && (
                          <button onClick={(e) => { e.stopPropagation(); handleMakeOffer(t.id); }} className="w-full bg-slate-900 text-white text-xs py-2 rounded-lg font-bold hover:bg-emerald-600 transition">
                            Make Offer
                          </button>
                        )}
                        {role === 'vendor' && isRequest && t.vendor_id === session.user.id && (
                          <div className="w-full text-center text-[10px] text-amber-700 font-bold bg-amber-50 py-1 rounded">Your Request</div>
                        )}
                        {role === 'farmer' && isRequest && (
                          <button onClick={(e) => { e.stopPropagation(); handleFulfillRequest(t.id); }} className="w-full bg-emerald-600 text-white text-xs py-2 rounded-lg font-bold hover:bg-emerald-700 transition shadow-lg shadow-emerald-200">
                            Fulfill Order
                          </button>
                        )}
                        {role === 'farmer' && isListing && t.farmer_id === session.user.id && (
                          <div className="w-full text-center text-[10px] text-emerald-600 font-bold bg-emerald-50 py-1 rounded">Your Listing</div>
                        )}
                      </div>
                    </div>
                  );
              })}
              
              {transactions.filter(t => t.status === 'listed').filter(t => activeCategory === 'All' || t.category === activeCategory).length === 0 && (
                <div className="col-span-2 text-center py-10 text-slate-400 text-sm flex flex-col items-center gap-3">
                  <p>No listings available in this category.</p>
                  <button onClick={() => setSetupRequired(true)} className="text-xs text-emerald-600 underline">Don't see items? Check Database Rules</button>
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'create' && (
          <div className="animate-in slide-in-from-bottom-5 duration-300">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h2 className="text-xl font-bold text-slate-800 mb-6">{role === 'farmer' ? 'List Produce (Sell)' : 'Create Request (Buy)'}</h2>
              <form onSubmit={handleCreateTransaction} className="space-y-5">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Title / Item Name</label>
                  <input 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="e.g., 500kg Yellow Corn"
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Category</label>
                  <select 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value)}
                  >
                    <option>Vegetables</option>
                    <option>Fruits</option>
                    <option>Grains</option>
                    <option>Livestock</option>
                    <option>Other</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Amount (KES)</label>
                  <input 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-mono"
                    type="number"
                    placeholder="50000"
                    value={newAmount}
                    onChange={e => setNewAmount(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Description / Terms</label>
                  <textarea 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none h-24 resize-none"
                    placeholder="Delivery details, quality specifications..."
                    value={newDesc}
                    onChange={e => setNewDesc(e.target.value)}
                  />
                </div>

                <button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-xl font-bold shadow-lg shadow-emerald-600/20 active:scale-[0.98] transition">
                  {role === 'farmer' ? 'Post Listing to Market' : 'Post Request to Market'}
                </button>
                
                <p className="text-xs text-slate-400 text-center">
                  This will appear in the Marketplace for {role === 'farmer' ? 'Vendors' : 'Farmers'} to see.
                </p>
              </form>
            </div>
          </div>
        )}

        {view === 'wallet' && (
          <div className="space-y-4 animate-in fade-in">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 text-center">
              <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Wallet className="w-8 h-8 text-emerald-600" />
              </div>
              <h2 className="text-3xl font-mono font-bold text-slate-800">KES {wallet?.balance.toLocaleString() ?? '...'}</h2>
              <p className="text-slate-400 text-sm mb-6">Available Balance</p>
              <button 
                onClick={simulateMpesa}
                className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition"
              >
                Simulate Bank Deposit (+5,000)
              </button>
            </div>

            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <History className="w-4 h-4 text-slate-400" />
                Transaction History
              </h3>
              <div className="space-y-3">
                {/* Mock History Logic based on transactions */}
                {transactions
                  .filter(t => t.vendor_id === session.user.id && (t.status === 'in_escrow' || t.status === 'completed'))
                  .map(t => (
                    <div key={'w-'+t.id} className="flex justify-between items-center text-sm p-2 hover:bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center">
                          <ArrowUp className="w-4 h-4 text-red-500" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-700">Escrow Deposit</p>
                          <p className="text-xs text-slate-400">{t.title}</p>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-red-600">- {t.amount.toLocaleString()}</span>
                    </div>
                  ))}
                 {transactions
                  .filter(t => t.farmer_id === session.user.id && t.status === 'completed')
                  .map(t => (
                    <div key={'w-'+t.id} className="flex justify-between items-center text-sm p-2 hover:bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center">
                          <ArrowDown className="w-4 h-4 text-emerald-500" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-700">Payment Received</p>
                          <p className="text-xs text-slate-400">{t.title}</p>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-emerald-600">+ {t.amount.toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center text-sm p-2 hover:bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center">
                          <ArrowDown className="w-4 h-4 text-emerald-500" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-700">Deposit</p>
                          <p className="text-xs text-slate-400">M-Pesa Top Up</p>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-emerald-600">+ {wallet?.balance > 0 ? '5,000' : '0'}</span>
                    </div>
              </div>
            </div>
          </div>
        )}

        {view === 'profile' && (
          <div className="animate-in fade-in duration-300">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-slate-800">Edit Profile</h2>
                <button 
                  onClick={() => setSetupRequired(true)} 
                  className="text-[10px] bg-slate-100 text-slate-500 px-3 py-1.5 rounded-full font-bold hover:bg-slate-200 transition"
                >
                  DB Setup
                </button>
              </div>
              
              <div className="space-y-5">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Full Name</label>
                  <div className="relative">
                    <input 
                      className={`w-full p-3 pl-10 bg-slate-50 border ${profileErrors.name ? 'border-red-300' : 'border-slate-200'} rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none`}
                      placeholder="John Doe"
                      value={profileName}
                      onChange={e => { setProfileName(e.target.value); if(profileErrors.name) setProfileErrors({...profileErrors, name: null}); }}
                    />
                    <User className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                  {profileErrors.name && <p className="text-red-500 text-xs mt-1 font-medium">{profileErrors.name}</p>}
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Email Address</label>
                  <div className="relative">
                    <input 
                      className={`w-full p-3 pl-10 bg-slate-50 border ${profileErrors.email ? 'border-red-300' : 'border-slate-200'} rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none`}
                      placeholder="you@example.com"
                      value={profileEmail}
                      onChange={e => { setProfileEmail(e.target.value); if(profileErrors.email) setProfileErrors({...profileErrors, email: null}); }}
                    />
                    <Mail className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                  {profileErrors.email && <p className="text-red-500 text-xs mt-1 font-medium">{profileErrors.email}</p>}
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Phone Number</label>
                  <div className="relative">
                    <input 
                      className={`w-full p-3 pl-10 bg-slate-50 border ${profileErrors.phone ? 'border-red-300' : 'border-slate-200'} rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-mono`}
                      placeholder="07XX XXX XXX"
                      value={profilePhone}
                      onChange={e => { setProfilePhone(e.target.value); if(profileErrors.phone) setProfileErrors({...profileErrors, phone: null}); }}
                    />
                    <Phone className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                  {profileErrors.phone && <p className="text-red-500 text-xs mt-1 font-medium">{profileErrors.phone}</p>}
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Location / Base</label>
                  <div className="relative">
                    <input 
                      className={`w-full p-3 pl-10 bg-slate-50 border ${profileErrors.location ? 'border-red-300' : 'border-slate-200'} rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none`}
                      placeholder="e.g. Nairobi, Kilimani"
                      value={profileLocation}
                      onChange={e => { setProfileLocation(e.target.value); if(profileErrors.location) setProfileErrors({...profileErrors, location: null}); }}
                    />
                    <MapPin className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                  {profileErrors.location && <p className="text-red-500 text-xs mt-1 font-medium">{profileErrors.location}</p>}
                </div>

                <div className="pt-2">
                  <button 
                    onClick={handleSaveProfile}
                    className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-emerald-700 active:scale-[0.98] transition flex items-center justify-center gap-2"
                  >
                    <Save className="w-5 h-5" />
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {selectedTransaction && (
        <TransactionDetail 
          transaction={selectedTransaction} 
          onClose={() => setSelectedTxId(null)} 
        />
      )}

      {/* Tour Overlay */}
      {tourStepIndex >= 0 && (
        <Tour 
          steps={tourSteps} 
          currentStep={tourStepIndex}
          onNext={() => {
            const nextIndex = tourStepIndex + 1;
            if (nextIndex < tourSteps.length) {
              // Automatically switch view if needed
              const nextStep = tourSteps[nextIndex];
              if (nextStep.view && nextStep.view !== view) {
                setView(nextStep.view);
              }
              setTourStepIndex(nextIndex);
            } else {
              setTourStepIndex(-1); // Finish
            }
          }}
          onClose={() => setTourStepIndex(-1)} 
        />
      )}

      {/* Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-slate-200 p-2 pb-6 max-w-md mx-auto flex justify-around items-center z-40">
        <button id="nav-home" onClick={() => setView('dashboard')} className={`p-3 rounded-2xl transition duration-300 flex flex-col items-center gap-1 ${view === 'dashboard' ? 'bg-emerald-100 text-emerald-800' : 'text-slate-400 hover:bg-slate-50'}`}>
          <List className="w-6 h-6" />
          <span className="text-[10px] font-bold">Home</span>
        </button>
        <button id="nav-market" onClick={() => setView('market')} className={`p-3 rounded-2xl transition duration-300 flex flex-col items-center gap-1 ${view === 'market' ? 'bg-emerald-100 text-emerald-800' : 'text-slate-400 hover:bg-slate-50'}`}>
          <Store className="w-6 h-6" />
          <span className="text-[10px] font-bold">Market</span>
        </button>
        <button id="nav-create" onClick={() => setView('create')} className="p-4 bg-emerald-600 text-white rounded-full shadow-lg shadow-emerald-600/30 transform -translate-y-6 hover:scale-105 transition active:scale-95">
          <Plus className="w-7 h-7" />
        </button>
        <button id="nav-wallet" onClick={() => setView('wallet')} className={`p-3 rounded-2xl transition duration-300 flex flex-col items-center gap-1 ${view === 'wallet' ? 'bg-emerald-100 text-emerald-800' : 'text-slate-400 hover:bg-slate-50'}`}>
          <Wallet className="w-6 h-6" />
          <span className="text-[10px] font-bold">Wallet</span>
        </button>
        <button onClick={() => setView('profile')} className={`p-3 rounded-2xl transition duration-300 flex flex-col items-center gap-1 ${view === 'profile' ? 'bg-emerald-100 text-emerald-800' : 'text-slate-400 hover:bg-slate-50'}`}>
          <User className="w-6 h-6" />
          <span className="text-[10px] font-bold">Profile</span>
        </button>
      </div>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);