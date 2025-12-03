
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import QRCode from 'https://esm.sh/react-qr-code';
import { Html5QrcodeScanner } from 'https://esm.sh/html5-qrcode';
import { 
  ShieldCheck, 
  Sprout, 
  Store, 
  Plus, 
  DollarSign, 
  Truck, 
  CheckCircle, 
  AlertTriangle, 
  LogOut, 
  User, 
  List,
  ChevronRight,
  Loader2,
  Lock,
  Copy,
  ShoppingBag,
  Search,
  Wallet,
  TrendingUp,
  ArrowRightLeft,
  CreditCard,
  MessageCircle,
  QrCode,
  ScanLine,
  Gavel,
  XCircle,
  Send,
  Leaf,
  Handshake,
  X,
  Megaphone,
  Bell,
  Info,
  Scale,
  TrendingDown
} from 'https://esm.sh/lucide-react';

// --- Configuration ---
const SUPABASE_URL = 'https://riltljeipcaplvwtejaj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpbHRsamVpcGNhcGx2d3RlamFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2MTAzMzcsImV4cCI6MjA4MDE4NjMzN30.StgCRcE7brtSvTARLsfmWHXNQvPcyRl8WiPUNuY9v0Y';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- Types ---
type UserRole = 'farmer' | 'vendor';
type TransactionStatus = 'listed' | 'offer_made' | 'pending_deposit' | 'in_escrow' | 'shipped' | 'delivered' | 'completed' | 'disputed';

interface Transaction {
  id: string;
  created_at: string;
  title: string;
  amount: number;
  description: string;
  status: TransactionStatus;
  farmer_id?: string;
  vendor_id?: string;
  vendor_email?: string;
  farmer_email?: string;
  delivery_pin?: string; // Secret pin for delivery verification
  category?: string;
  quantity?: number;
}

interface WalletData {
  user_id: string;
  balance: number;
}

interface Message {
  id: string;
  transaction_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender_email?: string;
}

const CATEGORIES = ['Maize', 'Beans', 'Potatoes', 'Tomatoes', 'Onions', 'Cabbage', 'Rice', 'Wheat', 'Carrots', 'Avocado', 'Mangoes', 'Other'];

// --- Components ---

// 1. Loading Spinner
const Loading = () => (
  <div className="flex items-center justify-center min-h-screen bg-slate-50">
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <div className="absolute inset-0 bg-emerald-200 rounded-full animate-ping opacity-75"></div>
        <div className="relative bg-white p-3 rounded-full shadow-lg">
          <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
        </div>
      </div>
      <p className="text-slate-500 text-sm font-medium tracking-wide">Connecting to Mkulima Express...</p>
    </div>
  </div>
);

// 2. Setup Helper
const SetupRequired = () => {
  const [copied, setCopied] = useState(false);
  
  const sql = `-- 1. Create Wallets Table
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
  delivery_pin text default substring(md5(random()::text) from 0 for 7), -- 6 char PIN
  category text default 'Other',
  quantity numeric default 0
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

-- 4. MIGRATION & COLUMNS (Safe to run multiple times)
alter table public.escrow_transactions alter column vendor_id drop not null;
do $$ 
begin 
  if not exists (select 1 from information_schema.columns where table_name='escrow_transactions' and column_name='delivery_pin') then
    alter table public.escrow_transactions add column delivery_pin text default substring(md5(random()::text) from 0 for 7);
  end if;
  if not exists (select 1 from information_schema.columns where table_name='escrow_transactions' and column_name='category') then
    alter table public.escrow_transactions add column category text default 'Other';
  end if;
  if not exists (select 1 from information_schema.columns where table_name='escrow_transactions' and column_name='quantity') then
    alter table public.escrow_transactions add column quantity numeric default 0;
  end if;
end $$;

-- 5. ENABLE SECURITY (RLS)
alter table public.wallets enable row level security;
alter table public.escrow_transactions enable row level security;
alter table public.messages enable row level security;

-- 6. STRICT POLICIES (Data Isolation)
-- Reset existing policies to avoid conflicts
drop policy if exists "Access own wallet" on public.wallets;
drop policy if exists "Access transactions" on public.escrow_transactions;
drop policy if exists "View transactions" on public.escrow_transactions;
drop policy if exists "Insert transactions" on public.escrow_transactions;
drop policy if exists "Update transactions" on public.escrow_transactions;
drop policy if exists "Access messages" on public.messages;

-- Wallet: Only owner can see
create policy "Access own wallet" on public.wallets for all using (auth.uid() = user_id);

-- Transactions: 
-- View: You are involved OR it is a public listing
create policy "View transactions" on public.escrow_transactions for select
using (
  vendor_id = auth.uid() or 
  farmer_id = auth.uid() or 
  status = 'listed'
);

-- Insert: You must be the recorded creator
create policy "Insert transactions" on public.escrow_transactions for insert
with check (
  (vendor_id = auth.uid()) or (farmer_id = auth.uid())
);

-- Update: You are involved OR you are claiming a listing 
-- (Vendor claiming Farmer Listing OR Farmer claiming Vendor Request)
create policy "Update transactions" on public.escrow_transactions for update
using (
  vendor_id = auth.uid() or 
  farmer_id = auth.uid() or 
  (status = 'listed' and vendor_id is null) or
  (status = 'listed' and farmer_id is null)
);

-- Messages: Must be involved in the transaction
create policy "Access messages" on public.messages for all using (
  exists (
    select 1 from public.escrow_transactions t 
    where t.id = transaction_id 
    and (t.vendor_id = auth.uid() or t.farmer_id = auth.uid())
  )
);`;

  const copyToClipboard = () => {
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
          Please run this SQL in your Supabase dashboard to enable the Market visibility, secure transaction features, and Trend Analysis.
        </p>
        <div className="relative group">
          <pre className="bg-slate-900 text-slate-50 p-4 rounded-lg text-xs overflow-auto h-64 border border-slate-700 font-mono">
            {sql}
          </pre>
          <button 
            onClick={copyToClipboard}
            className="absolute top-2 right-2 bg-slate-700 hover:bg-slate-600 text-white p-2 rounded-md transition flex items-center gap-1 text-xs font-bold"
          >
            {copied ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Copy SQL'}
          </button>
        </div>
        <button 
          onClick={() => window.location.reload()}
          className="mt-6 w-full bg-amber-600 text-white py-3 rounded-lg font-semibold hover:bg-amber-700 transition shadow-md active:scale-[0.98]"
        >
          I've Run the SQL - Reload App
        </button>
      </div>
    </div>
  );
};

// 2.5 Toast Component
const Toast = ({ message, type, onClose }: { message: string, type: 'success' | 'error' | 'info', onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 6000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const styles = {
    success: 'bg-emerald-900 text-emerald-50 border-emerald-700/50',
    error: 'bg-red-900 text-red-50 border-red-700/50',
    info: 'bg-blue-900 text-blue-50 border-blue-700/50'
  };

  const icons = {
    success: <CheckCircle className="w-5 h-5" />,
    error: <AlertTriangle className="w-5 h-5" />,
    info: <Info className="w-5 h-5" />
  };

  const bgStyles = {
    success: 'bg-emerald-800',
    error: 'bg-red-800',
    info: 'bg-blue-800'
  };

  return (
    <div className={`fixed top-4 left-4 right-4 z-[100] flex items-center gap-3 p-4 rounded-xl shadow-2xl transition-all duration-500 animate-[slideIn_0.3s_ease-out] border ${styles[type]}`}>
      <div className={`p-2 rounded-full shrink-0 ${bgStyles[type]}`}>
        {icons[type]}
      </div>
      <div className="flex-1">
        <h4 className="font-bold text-sm mb-0.5 capitalize">{type}</h4>
        <p className="text-xs font-medium opacity-90 leading-relaxed">{message}</p>
      </div>
      <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition shrink-0">
        <XCircle className="w-5 h-5 opacity-50" />
      </button>
    </div>
  );
};

// 3. Auth Component
const Auth = ({ onLogin }: { onLogin: () => void }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('vendor');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setToast(null);

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
          },
        });
        if (error) throw error;

        // Check if session is null (implies email verification required)
        if (data.user && !data.session) {
          setToast({
             message: "Account created successfully! We've sent a verification link to your email. Please verify to log in.",
             type: 'success'
          });
          setIsLogin(true); // Switch to login view
          setLoading(false);
          return;
        }
      }
      onLogin();
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 relative">
      {/* Toast Notification */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="bg-white w-full max-w-md p-8 rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-100 relative overflow-hidden">
         {/* Background Decorations */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-bl-full -z-0 opacity-50"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-emerald-50 rounded-tr-full -z-0 opacity-50"></div>

        <div className="flex flex-col items-center mb-8 relative z-10">
          <div className="w-20 h-20 bg-emerald-50 rounded-2xl flex items-center justify-center mb-5 shadow-sm border border-emerald-100 transform rotate-3 hover:rotate-0 transition duration-300 group">
             <div className="relative">
                <Sprout className="w-10 h-10 text-emerald-600 absolute -top-1 -left-1 opacity-20 group-hover:scale-110 transition" />
                <Sprout className="w-10 h-10 text-emerald-700 relative z-10" />
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
                <Sprout className="w-6 h-6" />
                <span className="text-sm font-bold">Farmer</span>
              </button>
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-emerald-700 hover:bg-emerald-800 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-emerald-700/30 transition active:scale-[0.98] mt-4 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (isLogin ? 'Sign In' : 'Create Account')}
            {!loading && <ChevronRight className="w-5 h-5" />}
          </button>
        </form>

        <p className="text-center mt-8 text-slate-500 text-sm relative z-10">
          {isLogin ? "New to Mkulima Express? " : "Already have an account? "}
          <button 
             onClick={() => {
               setIsLogin(!isLogin);
               setToast(null);
             }} 
             className="text-emerald-700 font-bold hover:underline transition"
          >
            {isLogin ? 'Create Account' : 'Log In'}
          </button>
        </p>
      </div>
    </div>
  );
};

// 4. Status Helpers
const StatusBadge = ({ status }: { status: TransactionStatus }) => {
  const styles = {
    listed: 'bg-slate-100 text-slate-700 border-slate-200',
    offer_made: 'bg-purple-50 text-purple-700 border-purple-200',
    pending_deposit: 'bg-amber-50 text-amber-700 border-amber-200',
    in_escrow: 'bg-blue-50 text-blue-700 border-blue-200',
    shipped: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    delivered: 'bg-teal-50 text-teal-700 border-teal-200',
    completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    disputed: 'bg-red-50 text-red-700 border-red-200',
  };

  const labels = {
    listed: 'Market Listed',
    offer_made: 'Offer Received',
    pending_deposit: 'Awaiting Deposit',
    in_escrow: 'Secure in Escrow',
    shipped: 'On The Way',
    delivered: 'Delivered',
    completed: 'Transaction Complete',
    disputed: 'Under Dispute',
  };

  return (
    <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${styles[status]}`}>
      {labels[status]}
    </span>
  );
};

// 5. Main App Component
const App = () => {
  const [session, setSession] = useState<any>(null);
  const [userRole, setUserRole] = useState<UserRole>('vendor'); // Default fallback
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'market' | 'wallet' | 'create'>('dashboard');
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [activeTransactionId, setActiveTransactionId] = useState<string | null>(null);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);

  // Forms
  const [newTitle, setNewTitle] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCategory, setNewCategory] = useState('Maize');
  const [newQuantity, setNewQuantity] = useState('');

  // Trends calculation (Rolling 7-Day Average)
  const marketTrends = useMemo(() => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // 1. Group transactions by category
    const byCategory: Record<string, Transaction[]> = {};
    
    transactions.forEach(t => {
      // Filter valid transactions for price calculation
      if (t.status === 'disputed' || !t.category || !t.quantity || t.quantity <= 0) return;
      
      const cat = t.category;
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(t);
    });

    // 2. Calculate trends for each category
    return Object.entries(byCategory).map(([name, txs]) => {
      // Sort desc (newest first)
      txs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      const getWeightedAvg = (list: Transaction[]) => {
        if (!list.length) return 0;
        const totalAmt = list.reduce((sum, t) => sum + t.amount, 0);
        const totalQty = list.reduce((sum, t) => sum + (t.quantity || 0), 0);
        return totalQty > 0 ? totalAmt / totalQty : 0;
      };

      // Define Windows
      const recentTxs = txs.filter(t => new Date(t.created_at) >= sevenDaysAgo);
      const previousTxs = txs.filter(t => {
         const d = new Date(t.created_at);
         return d >= fourteenDaysAgo && d < sevenDaysAgo;
      });

      let currentPrice = 0;
      let trendUp = true; // Default

      if (recentTxs.length > 0) {
         currentPrice = getWeightedAvg(recentTxs);
         
         if (previousTxs.length > 0) {
            const prevPrice = getWeightedAvg(previousTxs);
            // Higher price is "Up" (Green) generally, though for buyers it's bad. 
            // In market context, "Up" usually means value increase.
            trendUp = currentPrice >= prevPrice;
         } else {
            // Fallback: If no data in previous week, look for ANY older data
            const olderTxs = txs.filter(t => new Date(t.created_at) < sevenDaysAgo);
            if (olderTxs.length > 0) {
               const olderPrice = getWeightedAvg(olderTxs);
               trendUp = currentPrice >= olderPrice;
            } else if (recentTxs.length > 1) {
               // Intra-week trend if this is the very first week of data
               // recentTxs is sorted desc (newest first)
               const half = Math.ceil(recentTxs.length / 2);
               const newer = recentTxs.slice(0, half);
               const older = recentTxs.slice(half);
               trendUp = getWeightedAvg(newer) >= getWeightedAvg(older);
            }
         }
      } else {
         // No transactions in the last 7 days
         // Show the most recent known price as a fallback
         if (txs.length > 0) {
            currentPrice = getWeightedAvg([txs[0]]);
            if (txs.length > 1) {
               // Compare latest to the running average of the rest
               trendUp = currentPrice >= getWeightedAvg(txs.slice(1));
            }
         }
      }
      
      return {
        name,
        price: Math.round(currentPrice),
        up: trendUp,
        count: txs.length
      };
    })
    .filter(g => g.price > 0) // Hide zero price items
    .sort((a, b) => b.price - a.price); // Sort by highest value items
  }, [transactions]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        setUserRole(session.user.user_metadata.role || 'vendor');
        fetchData();
        fetchWallet(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        setUserRole(session.user.user_metadata.role || 'vendor');
        fetchData();
        fetchWallet(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Real-time Push Notifications Subscription
  useEffect(() => {
    if (!session) return;

    // Listen for Messages
    const msgChannel = supabase.channel('msg-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        async (payload) => {
          const newMsg = payload.new as Message;
          if (newMsg.sender_id === session.user.id) return; // Ignore own messages

          // Verify involvement (security/relevance check)
          const { data: tx } = await supabase.from('escrow_transactions').select('title, farmer_id, vendor_id').eq('id', newMsg.transaction_id).single();
          
          if (tx && (tx.farmer_id === session.user.id || tx.vendor_id === session.user.id)) {
            setToast({ message: `New message in "${tx.title}"`, type: 'info' });
          }
        }
      )
      .subscribe();

    // Listen for Transaction Updates (Status Changes)
    const txChannel = supabase.channel('tx-notifications')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'escrow_transactions' },
        (payload) => {
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
             setToast({ message: msg, type: newTx.status === 'disputed' ? 'error' : 'success' });
             fetchData(); // Refresh data to show new status in UI
           }
        }
      )
      .subscribe();

    return () => { 
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(txChannel);
    };
  }, [session]);

  const fetchData = async () => {
    setLoading(true);
    // RLS filters this automatically on the backend now
    const { data, error } = await supabase
      .from('escrow_transactions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === '42P01') setSetupNeeded(true); // Table undefined
    } else {
      setTransactions(data || []);
    }
    setLoading(false);
  };

  const fetchWallet = async (userId: string) => {
    const { data, error } = await supabase.from('wallets').select('*').eq('user_id', userId).single();
    if (error && error.code === 'PGRST116') {
      // Wallet doesn't exist, create it
      const { data: newData, error: createError } = await supabase
        .from('wallets')
        .insert([{ user_id: userId, balance: 0 }])
        .select()
        .single();
      if (newData) setWallet(newData);
    } else if (data) {
      setWallet(data);
    }
  };

  const createTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    
    // Vendor creates a REQUEST, Farmer creates a LISTING
    const isVendor = userRole === 'vendor';
    
    const { error } = await supabase.from('escrow_transactions').insert({
      title: newTitle,
      amount: parseFloat(newAmount),
      description: newDesc,
      category: newCategory,
      quantity: parseFloat(newQuantity),
      vendor_id: isVendor ? session.user.id : null,
      farmer_id: isVendor ? null : session.user.id,
      vendor_email: isVendor ? session.user.email : null,
      farmer_email: isVendor ? null : session.user.email,
      status: 'listed', // Both default to 'listed' so they are visible in market
    });

    if (!error) {
      setNewTitle('');
      setNewAmount('');
      setNewDesc('');
      setNewQuantity('');
      setNewCategory('Maize');
      setActiveTab('dashboard');
      fetchData();
      setToast({ message: 'Listed successfully on the market!', type: 'success' });
    } else {
      // Check for column error, might imply old schema
      if (error.code === '42703') {
         setToast({ message: "Database schema outdated. Please run the SQL setup again.", type: 'error' });
         setSetupNeeded(true);
      } else {
         setToast({ message: "Error creating transaction. Please try again.", type: 'error' });
      }
    }
  };

  const handleMakeOffer = async (transactionId: string) => {
    if (!session || userRole !== 'vendor') return;

    const { error } = await supabase
      .from('escrow_transactions')
      .update({ 
        vendor_id: session.user.id, 
        vendor_email: session.user.email,
        status: 'offer_made' // Move to offer_made stage
      })
      .eq('id', transactionId)
      // Safety check: ensure it is still listed and unclaimed
      .eq('status', 'listed')
      .is('vendor_id', null);

    if (!error) {
      fetchData();
      setActiveTransactionId(transactionId);
      setToast({ message: 'Offer sent to Farmer!', type: 'success' });
    } else {
      setToast({ message: "Could not make offer. It may have been taken.", type: 'error' });
    }
  };

  const handleFulfillRequest = async (transactionId: string) => {
    if (!session || userRole !== 'farmer') return;

    const { error } = await supabase
      .from('escrow_transactions')
      .update({ 
        farmer_id: session.user.id, 
        farmer_email: session.user.email,
        status: 'pending_deposit' // Immediately contract formed, waiting for funding
      })
      .eq('id', transactionId)
      // Safety check: ensure it is still listed and unclaimed by a farmer
      .eq('status', 'listed')
      .is('farmer_id', null);

    if (!error) {
      fetchData();
      setActiveTransactionId(transactionId);
      setToast({ message: 'Order fulfilled! Waiting for deposit.', type: 'success' });
    } else {
      setToast({ message: "Could not fulfill request. It may have been taken.", type: 'error' });
    }
  };

  const topUpWallet = async () => {
    if (!session) return;

    const amount = 5000; // Default top up amount
    const phoneNumber = prompt('Enter your M-Pesa phone number (e.g. 2547XXXXXXXX):');
    if (!phoneNumber) return;

    try {
      const response = await fetch('http://localhost:4000/mpesa/stk-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          phoneNumber,
          accountReference: `WALLET_${session.user.id}`,
          description: 'Mkulima Express wallet top up'
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data?.error?.errorMessage || 'Failed to initiate M-Pesa payment');
      }

      setToast({
        message: 'STK Push sent. Check your phone to approve payment.',
        type: 'info'
      });
    } catch (error: any) {
      setToast({
        message: error.message || 'Error starting M-Pesa payment',
        type: 'error'
      });
    }
  };

  const activeTransaction = useMemo(() => 
    transactions.find(t => t.id === activeTransactionId), 
  [transactions, activeTransactionId]);

  if (loading) return <Loading />;
  if (setupNeeded) return <SetupRequired />;
  if (!session) return <Auth onLogin={() => {}} />;

  // --- SUB-COMPONENTS FOR MAIN APP ---

  const TransactionDetails = ({ transaction, onClose }: { transaction: Transaction, onClose: () => void }) => {
    const [msgText, setMsgText] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [view, setView] = useState<'info' | 'chat' | 'logistics'>('info');
    const scrollRef = useRef<HTMLDivElement>(null);
    const [qrScannerOpen, setQrScannerOpen] = useState(false);
    const [pinInput, setPinInput] = useState('');

    useEffect(() => {
      const fetchMsgs = async () => {
        const { data } = await supabase
          .from('messages')
          .select('*')
          .eq('transaction_id', transaction.id)
          .order('created_at', { ascending: true });
        setMessages(data || []);
      };
      
      fetchMsgs();

      const channel = supabase
        .channel('msgs')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `transaction_id=eq.${transaction.id}` }, (payload) => {
          setMessages(prev => [...prev, payload.new as Message]);
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }, [transaction.id]);

    useEffect(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages, view]);

    const sendMessage = async () => {
      if (!msgText.trim()) return;
      await supabase.from('messages').insert({
        transaction_id: transaction.id,
        sender_id: session.user.id,
        sender_email: session.user.email,
        content: msgText
      });
      setMsgText('');
    };

    const updateStatus = async (newStatus: TransactionStatus, resetVendor = false) => {
      // Wallet Logic for funding
      if (newStatus === 'in_escrow' && transaction.status === 'pending_deposit') {
        if (!wallet || wallet.balance < transaction.amount) {
          setToast({ message: "Insufficient funds in wallet! Please top up.", type: 'error' });
          return;
        }
        // Deduct from Vendor
        await supabase.from('wallets').update({ balance: wallet.balance - transaction.amount }).eq('user_id', session.user.id);
      }

      // Wallet Logic for Release
      if (newStatus === 'completed' && transaction.status === 'delivered') {
         // Add to Farmer
         if (transaction.farmer_id) {
            const { data: farmerWallet } = await supabase.from('wallets').select('balance').eq('user_id', transaction.farmer_id).single();
            if (farmerWallet) {
              await supabase.from('wallets').update({ balance: farmerWallet.balance + transaction.amount }).eq('user_id', transaction.farmer_id);
            }
         }
      }

      const updates: any = { status: newStatus };
      if (resetVendor) {
        updates.vendor_id = null;
        updates.vendor_email = null;
      }

      const { error } = await supabase.from('escrow_transactions').update(updates).eq('id', transaction.id);
      
      if (!error) {
        fetchData();
        fetchWallet(session.user.id);
        if (newStatus === 'completed' || resetVendor) {
           setToast({ message: 'Transaction updated successfully', type: 'success' });
           onClose();
        }
      } else {
        setToast({ message: "Failed to update status", type: 'error' });
      }
    };

    const handleQrSuccess = async (decodedText: string) => {
       setQrScannerOpen(false);
       if (decodedText === transaction.delivery_pin) {
         updateStatus('delivered');
       } else {
         setToast({ message: "Invalid Delivery QR Code!", type: 'error' });
       }
    };

    const manualVerify = () => {
      if (pinInput === transaction.delivery_pin) {
        updateStatus('delivered');
      } else {
        setToast({ message: "Invalid PIN code", type: 'error' });
      }
    }

    // Strict Identity Checks for UI Controls
    const isOwnerFarmer = session.user.id === transaction.farmer_id;
    const isOwnerVendor = session.user.id === transaction.vendor_id;
    
    // Fallback for role-based view (e.g. seeing a listing)
    const canSeeControls = isOwnerFarmer || isOwnerVendor;

    return (
      <div className="fixed inset-0 bg-slate-50 z-50 flex flex-col animate-in slide-in-from-bottom-10 duration-200">
        {/* Header */}
        <div className="bg-white px-4 py-4 border-b flex items-center gap-3 sticky top-0 z-10 shadow-sm">
          <button onClick={onClose} className="p-2 -ml-2 hover:bg-slate-100 rounded-full">
            <ChevronRight className="w-6 h-6 rotate-180 text-slate-600" />
          </button>
          <div className="flex-1">
            <h2 className="font-bold text-slate-800 text-lg leading-tight">{transaction.title}</h2>
            <p className="text-xs text-slate-500 font-mono">ID: {transaction.id.slice(0, 8)}</p>
          </div>
          <StatusBadge status={transaction.status} />
        </div>

        {/* Tabs */}
        <div className="flex bg-white border-b">
           <button onClick={() => setView('info')} className={`flex-1 py-3 text-sm font-semibold border-b-2 transition ${view === 'info' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-400'}`}>Details</button>
           <button onClick={() => setView('chat')} className={`flex-1 py-3 text-sm font-semibold border-b-2 transition ${view === 'chat' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-400'}`}>Chat</button>
           <button onClick={() => setView('logistics')} className={`flex-1 py-3 text-sm font-semibold border-b-2 transition ${view === 'logistics' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-400'}`}>Logistics</button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-slate-50 p-4">
           {view === 'info' && (
             <div className="space-y-6">
                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100">
                  <div className="flex justify-between items-start mb-4">
                     <div>
                       <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Amount</span>
                       <div className="text-3xl font-mono font-bold text-emerald-700 mt-1">KES {transaction.amount.toLocaleString()}</div>
                     </div>
                     {transaction.category && (
                       <div className="text-right">
                         <span className="block px-3 py-1 bg-slate-100 rounded-lg text-xs font-bold text-slate-600 mb-1">{transaction.category}</span>
                         {transaction.quantity ? (
                           <span className="text-sm text-slate-500 font-medium">{transaction.quantity} kg</span>
                         ) : null}
                       </div>
                     )}
                  </div>
                  
                  {/* Price Analysis */}
                  {transaction.quantity && transaction.quantity > 0 && (
                    <div className="bg-emerald-50 p-3 rounded-lg flex items-center justify-between mb-4 border border-emerald-100">
                       <span className="text-xs text-emerald-800 font-bold">Price per Kg</span>
                       <span className="text-sm font-mono font-bold text-emerald-800">
                         ~KES {Math.round(transaction.amount / transaction.quantity).toLocaleString()}/kg
                       </span>
                    </div>
                  )}

                  <div className="pt-4 border-t border-slate-50">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Description</span>
                    <p className="text-slate-700 leading-relaxed">{transaction.description || 'No description provided.'}</p>
                  </div>
                  {/* Identity Badge */}
                  <div className="mt-4 flex gap-2">
                     {isOwnerFarmer && <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-1 rounded-full font-bold">You are the Farmer</span>}
                     {isOwnerVendor && <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-bold">You are the Vendor</span>}
                     {!isOwnerFarmer && !isOwnerVendor && <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded-full font-bold">Read Only View</span>}
                  </div>
                </div>

                {/* Timeline */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100">
                   <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                     <TrendingUp className="w-5 h-5 text-emerald-600" />
                     Progress
                   </h3>
                   <div className="space-y-6 relative pl-2">
                      <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-slate-100"></div>
                      {[
                        { s: 'listed', l: 'Listed on Market', done: true },
                        { s: 'offer_made', l: 'Offer Received', done: transaction.status !== 'listed' },
                        { s: 'pending_deposit', l: 'Contract Formed', done: ['pending_deposit', 'in_escrow', 'shipped', 'delivered', 'completed'].includes(transaction.status) },
                        { s: 'in_escrow', l: 'Funds Secured', done: ['in_escrow', 'shipped', 'delivered', 'completed'].includes(transaction.status) },
                        { s: 'shipped', l: 'Goods Shipped', done: ['shipped', 'delivered', 'completed'].includes(transaction.status) },
                        { s: 'delivered', l: 'Delivered', done: ['delivered', 'completed'].includes(transaction.status) },
                        { s: 'completed', l: 'Funds Released', done: transaction.status === 'completed' }
                      ].map((step, idx) => (
                        <div key={idx} className="relative flex items-center gap-3">
                           <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center relative z-10 bg-white ${step.done ? 'border-emerald-500 text-emerald-500' : 'border-slate-200 text-slate-300'}`}>
                             {step.done ? <CheckCircle className="w-4 h-4" /> : <div className="w-2 h-2 rounded-full bg-slate-200"></div>}
                           </div>
                           <span className={`text-sm font-medium ${step.done ? 'text-slate-800' : 'text-slate-400'}`}>{step.l}</span>
                        </div>
                      ))}
                   </div>
                </div>

                {/* Actions - Strictly Controlled by Identity */}
                {canSeeControls && (
                  <div className="pb-8">
                     {/* Farmer: Accept or Reject Offer */}
                     {isOwnerFarmer && transaction.status === 'offer_made' && (
                       <div className="space-y-3">
                         <div className="bg-purple-50 p-4 rounded-xl border border-purple-200 mb-2">
                           <p className="text-sm text-purple-800 font-medium text-center">
                             A Vendor wants to buy this for <span className="font-bold">KES {transaction.amount.toLocaleString()}</span>.
                           </p>
                         </div>
                         <button onClick={() => updateStatus('pending_deposit')} className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 active:scale-95 transition flex items-center justify-center gap-2">
                           <Handshake className="w-5 h-5" /> Accept Offer
                         </button>
                         <button onClick={() => updateStatus('listed', true)} className="w-full bg-white text-slate-600 border border-slate-200 py-3 rounded-xl font-bold hover:bg-slate-50 active:scale-95 transition flex items-center justify-center gap-2">
                           <X className="w-5 h-5" /> Reject Offer
                         </button>
                       </div>
                     )}

                     {isOwnerVendor && transaction.status === 'offer_made' && (
                       <div className="bg-amber-50 p-4 rounded-xl text-amber-800 text-sm font-medium text-center border border-amber-200">
                         Waiting for Farmer to accept your offer.
                       </div>
                     )}

                     {isOwnerVendor && transaction.status === 'pending_deposit' && (
                       <button onClick={() => updateStatus('in_escrow')} className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 active:scale-95 transition flex items-center justify-center gap-2">
                         <Lock className="w-5 h-5" /> Deposit Funds (Escrow)
                       </button>
                     )}
                     
                     {/* Farmer Waiting for Deposit */}
                     {isOwnerFarmer && transaction.status === 'pending_deposit' && (
                        <div className="bg-blue-50 p-4 rounded-xl text-blue-800 text-sm font-medium text-center border border-blue-200">
                           Waiting for Vendor to deposit funds.
                        </div>
                     )}

                     {isOwnerFarmer && transaction.status === 'in_escrow' && (
                       <button onClick={() => updateStatus('shipped')} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition flex items-center justify-center gap-2">
                         <Truck className="w-5 h-5" /> Mark as Shipped
                       </button>
                     )}
                     {isOwnerVendor && transaction.status === 'delivered' && (
                       <button onClick={() => updateStatus('completed')} className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 active:scale-95 transition flex items-center justify-center gap-2">
                         <CheckCircle className="w-5 h-5" /> Release Payment
                       </button>
                     )}
                     {transaction.status !== 'completed' && transaction.status !== 'disputed' && transaction.status !== 'listed' && (
                       <button onClick={() => updateStatus('disputed')} className="mt-4 w-full bg-white text-red-600 border border-red-100 py-3 rounded-xl font-semibold hover:bg-red-50 transition flex items-center justify-center gap-2">
                         <Gavel className="w-4 h-4" /> Raise Dispute
                       </button>
                     )}
                  </div>
                )}
             </div>
           )}

           {view === 'chat' && (
             <div className="flex flex-col h-full">
               <div className="flex-1 space-y-4 mb-4" ref={scrollRef}>
                  {messages.length === 0 && <div className="text-center text-slate-400 mt-10 text-sm">No messages yet. Start discussing!</div>}
                  {messages.map(m => {
                    const isMe = m.sender_id === session.user.id;
                    return (
                      <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${isMe ? 'bg-emerald-600 text-white rounded-tr-none' : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none'}`}>
                          {m.content}
                        </div>
                      </div>
                    )
                  })}
               </div>
               <div className="flex items-center gap-2 bg-white p-2 rounded-full border border-slate-200 shadow-sm">
                 <input 
                   className="flex-1 bg-transparent px-4 py-2 outline-none text-sm" 
                   placeholder="Type a message..." 
                   value={msgText}
                   onChange={e => setMsgText(e.target.value)}
                 />
                 <button onClick={sendMessage} className="p-2 bg-emerald-600 text-white rounded-full hover:bg-emerald-700 transition">
                   <Send className="w-5 h-5" />
                 </button>
               </div>
             </div>
           )}

           {view === 'logistics' && (
             <div className="space-y-6">
               <div className="bg-white p-6 rounded-xl shadow-sm text-center border border-slate-100">
                  <h3 className="font-bold text-slate-800 mb-2">Delivery Verification</h3>
                  <p className="text-slate-500 text-sm mb-6">Use this QR code to securely verify delivery.</p>
                  
                  {isOwnerFarmer ? (
                     transaction.status === 'shipped' || transaction.status === 'delivered' ? (
                       <div className="flex flex-col items-center">
                         <div className="bg-white p-4 rounded-xl border-2 border-slate-900 mb-4">
                           <QRCode value={transaction.delivery_pin || 'error'} size={180} />
                         </div>
                         <p className="text-xs font-mono text-slate-400">PIN: {transaction.delivery_pin}</p>
                         <p className="text-sm font-medium text-emerald-700 mt-4 bg-emerald-50 px-4 py-2 rounded-lg">Show this to Vendor upon delivery</p>
                       </div>
                     ) : (
                       <div className="p-8 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                         <Truck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                         <p className="text-sm text-slate-400">QR Code generates when marked as shipped.</p>
                       </div>
                     )
                  ) : isOwnerVendor ? (
                     // Vendor View
                     <div className="flex flex-col items-center">
                        {qrScannerOpen ? (
                          <div className="w-full rounded-xl overflow-hidden mb-4 relative bg-black h-64">
                             {/* Mock Scanner UI since html5-qrcode needs real DOM element mounting which is tricky in this inline setup, we use simple fallback for demo */}
                             <div className="absolute inset-0 flex items-center justify-center text-white text-xs">
                               <p>Camera would open here in prod.</p>
                             </div>
                             {/* In a real implementation, <div id="reader"></div> would go here with useEffect hook to Html5QrcodeScanner */}
                          </div>
                        ) : (
                          <button onClick={() => setQrScannerOpen(true)} className="mb-6 p-6 bg-slate-50 rounded-full border-2 border-emerald-100 hover:border-emerald-500 hover:bg-emerald-50 transition group">
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
                             <button onClick={manualVerify} className="px-6 bg-slate-800 text-white rounded-xl font-bold">Verify</button>
                           </div>
                        </div>
                     </div>
                  ) : (
                    <div className="text-slate-400 italic text-sm">
                      Only the involved parties can access logistics.
                    </div>
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
      
      {/* Global Toast Container */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md sticky top-0 z-30 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-100 p-2 rounded-lg">
            <Sprout className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <h1 className="font-extrabold text-emerald-950 text-lg leading-none">Mkulima Express</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{userRole}</p>
          </div>
        </div>
        <button onClick={() => supabase.auth.signOut()} className="p-2 text-slate-400 hover:text-red-500 transition bg-slate-50 rounded-full">
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      {/* Main Content Areas */}
      <div className="p-4 space-y-4">
        
        {/* Dashboard View */}
        {activeTab === 'dashboard' && (
          <div className="space-y-4 animate-in fade-in duration-500">
             {/* Stats Card */}
             <div className="bg-gradient-to-br from-emerald-800 to-emerald-600 rounded-2xl p-6 text-white shadow-xl shadow-emerald-700/20 relative overflow-hidden">
                <div className="absolute -right-4 -bottom-4 bg-white/10 w-32 h-32 rounded-full blur-2xl"></div>
                <div className="relative z-10">
                  <div className="flex items-center gap-2 text-emerald-200 mb-1 text-sm font-medium">
                    <Wallet className="w-4 h-4" /> Wallet Balance
                  </div>
                  <div className="text-3xl font-mono font-bold tracking-tight">KES {wallet?.balance.toLocaleString() ?? '...'}</div>
                  <div className="mt-4 flex gap-2">
                    <button onClick={() => setActiveTab('wallet')} className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-xs font-bold backdrop-blur-sm transition">
                      Top Up
                    </button>
                    <button className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-xs font-bold backdrop-blur-sm transition">
                      Withdraw
                    </button>
                  </div>
                </div>
             </div>

             {/* Recent Activity */}
             <div>
               <div className="flex justify-between items-center mb-3 px-1">
                 <h2 className="font-bold text-slate-800">Your Activity</h2>
                 <span className="text-xs text-emerald-600 font-semibold cursor-pointer">View All</span>
               </div>
               
               {/* Dashboard Filter: Only show items relevant to the current user */}
               {transactions.filter(t => t.farmer_id === session.user.id || t.vendor_id === session.user.id).length === 0 ? (
                 <div className="text-center py-10 bg-white rounded-xl border border-dashed border-slate-300">
                   <Leaf className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                   <p className="text-slate-500 text-sm">No transactions yet.</p>
                   <button onClick={() => setActiveTab('create')} className="mt-3 text-emerald-700 font-bold text-sm hover:underline">Start New</button>
                 </div>
               ) : (
                 <div className="space-y-3">
                   {transactions
                    .filter(t => t.farmer_id === session.user.id || t.vendor_id === session.user.id)
                    .map(t => (
                     <div key={t.id} onClick={() => setActiveTransactionId(t.id)} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4 hover:shadow-md transition cursor-pointer active:scale-[0.99]">
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

        {/* Marketplace View */}
        {activeTab === 'market' && (
          <div className="animate-in fade-in duration-500 space-y-4">
             {/* Market Insights */}
             <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Market Trends (Avg Price/kg)</h3>
                  <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-1 rounded-full font-medium">Rolling 7-Day</span>
                </div>
                <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                   {marketTrends.length === 0 ? (
                     <div className="text-xs text-slate-400 w-full text-center italic py-2">
                       No sales data yet. Start listing produce to see trends!
                     </div>
                   ) : (
                     marketTrends.map((item, i) => (
                       <div key={i} className="min-w-[100px] p-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-col items-center">
                          <span className="text-xs text-slate-500 font-medium mb-1">{item.name}</span>
                          <span className="text-lg font-bold text-slate-800 font-mono">KES {item.price}</span>
                          <div className={`text-[10px] flex items-center gap-1 font-semibold ${item.up ? 'text-emerald-600' : 'text-red-500'}`}>
                            {item.up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {item.up ? 'Up' : 'Down'}
                          </div>
                       </div>
                     ))
                   )}
                </div>
             </div>

             <div className="grid grid-cols-2 gap-3">
                {/* 
                  Marketplace Logic:
                  Shows both Farmer Listings (Selling) and Vendor Requests (Buying).
                */}
                {transactions.filter(t => t.status === 'listed').map(t => {
                  const isVendorRequest = !t.farmer_id && t.vendor_id; // Created by Vendor, needs Farmer
                  const isFarmerListing = !t.vendor_id && t.farmer_id; // Created by Farmer, needs Vendor

                  return (
                    <div key={t.id} onClick={() => setActiveTransactionId(t.id)} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm hover:border-emerald-500 transition cursor-pointer group flex flex-col h-full">
                       <div className={`h-24 rounded-lg mb-3 flex items-center justify-center transition relative overflow-hidden ${isVendorRequest ? 'bg-amber-50 group-hover:bg-amber-100' : 'bg-emerald-50 group-hover:bg-emerald-100'}`}>
                          {isVendorRequest ? (
                             <Megaphone className="w-8 h-8 text-amber-400 group-hover:text-amber-500" />
                          ) : (
                             <ShoppingBag className="w-8 h-8 text-emerald-400 group-hover:text-emerald-500" />
                          )}
                          <div className={`absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded ${isVendorRequest ? 'bg-amber-200 text-amber-800' : 'bg-emerald-200 text-emerald-800'}`}>
                            {isVendorRequest ? 'WANTED' : 'FOR SALE'}
                          </div>
                       </div>
                       <h4 className="font-bold text-slate-800 text-sm truncate">{t.title}</h4>
                       <div className="flex justify-between items-end mt-1">
                         <p className="text-emerald-700 font-mono font-bold text-sm">KES {t.amount.toLocaleString()}</p>
                         {t.quantity && t.quantity > 0 && (
                           <p className="text-[10px] text-slate-400 font-mono">@{Math.round(t.amount/t.quantity)}/kg</p>
                         )}
                       </div>
                       {t.quantity ? <p className="text-slate-400 text-xs mt-0.5">{t.quantity} kg</p> : null}
                       
                       <div className="mt-auto pt-3">
                        {/* Vendor View */}
                        {userRole === 'vendor' && isFarmerListing && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMakeOffer(t.id);
                            }}
                            className="w-full bg-slate-900 text-white text-xs py-2 rounded-lg font-bold hover:bg-emerald-600 transition"
                          >
                            Make Offer
                          </button>
                        )}
                        {userRole === 'vendor' && isVendorRequest && t.vendor_id === session.user.id && (
                          <div className="w-full text-center text-[10px] text-amber-700 font-bold bg-amber-50 py-1 rounded">
                             Your Request
                          </div>
                        )}

                        {/* Farmer View */}
                        {userRole === 'farmer' && isVendorRequest && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleFulfillRequest(t.id);
                            }}
                            className="w-full bg-emerald-600 text-white text-xs py-2 rounded-lg font-bold hover:bg-emerald-700 transition shadow-lg shadow-emerald-200"
                          >
                            Fulfill Order
                          </button>
                        )}
                        {userRole === 'farmer' && isFarmerListing && t.farmer_id === session.user.id && (
                           <div className="w-full text-center text-[10px] text-emerald-600 font-bold bg-emerald-50 py-1 rounded">
                              Your Listing
                           </div>
                        )}
                       </div>
                    </div>
                  );
                })}
                
                {transactions.filter(t => t.status === 'listed').length === 0 && (
                   <div className="col-span-2 text-center py-10 text-slate-400 text-sm flex flex-col items-center gap-3">
                      <p>No listings available right now.</p>
                      <button 
                        onClick={() => setSetupNeeded(true)}
                        className="text-xs text-emerald-600 underline"
                      >
                        Don't see items? Check Database Rules
                      </button>
                   </div>
                )}
             </div>
          </div>
        )}

        {/* Create / Wallet View */}
        {activeTab === 'create' && (
          <div className="animate-in slide-in-from-bottom-5 duration-300">
             <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h2 className="text-xl font-bold text-slate-800 mb-6">{userRole === 'farmer' ? 'List Produce (Sell)' : 'Create Request (Buy)'}</h2>
                <form onSubmit={createTransaction} className="space-y-5">
                   <div>
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Category</label>
                     <select 
                       className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition"
                       value={newCategory}
                       onChange={e => setNewCategory(e.target.value)}
                     >
                        {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                     </select>
                   </div>
                   <div>
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Title / Item Name</label>
                     <input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="e.g., 500kg Yellow Corn" value={newTitle} onChange={e => setNewTitle(e.target.value)} required />
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                     <div>
                       <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Quantity (kg)</label>
                       <input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-mono" type="number" placeholder="100" value={newQuantity} onChange={e => setNewQuantity(e.target.value)} required />
                     </div>
                     <div>
                       <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Total Amount (KES)</label>
                       <input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-mono" type="number" placeholder="50000" value={newAmount} onChange={e => setNewAmount(e.target.value)} required />
                     </div>
                   </div>
                   
                   {/* Price per Kg helper */}
                   {newAmount && newQuantity && (
                     <div className="bg-emerald-50 p-3 rounded-lg flex items-center justify-between">
                       <span className="text-xs font-bold text-emerald-800">Est. Price/kg</span>
                       <span className="text-sm font-mono font-bold text-emerald-700">
                         KES {Math.round(parseFloat(newAmount) / parseFloat(newQuantity)).toLocaleString()}
                       </span>
                     </div>
                   )}

                   <div>
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Description / Terms</label>
                     <textarea className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none h-24 resize-none" placeholder="Delivery details, quality specifications..." value={newDesc} onChange={e => setNewDesc(e.target.value)} />
                   </div>
                   <button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-xl font-bold shadow-lg shadow-emerald-600/20 active:scale-[0.98] transition">
                     {userRole === 'farmer' ? 'Post Listing to Market' : 'Post Request to Market'}
                   </button>
                   <p className="text-xs text-slate-400 text-center">
                     This will appear in the Marketplace for {userRole === 'farmer' ? 'Vendors' : 'Farmers'} to see.
                   </p>
                </form>
             </div>
          </div>
        )}

        {activeTab === 'wallet' && (
           <div className="space-y-4 animate-in fade-in">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 text-center">
                 <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Wallet className="w-8 h-8 text-emerald-600" />
                 </div>
                 <h2 className="text-3xl font-mono font-bold text-slate-800">KES {wallet?.balance.toLocaleString()}</h2>
                 <p className="text-slate-400 text-sm mb-6">Available Balance</p>
                 <button onClick={topUpWallet} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition">
                   Simulate Bank Deposit (+5,000)
                 </button>
              </div>
           </div>
        )}

      </div>

      {/* Transaction Overlay */}
      {activeTransaction && (
         <TransactionDetails transaction={activeTransaction} onClose={() => setActiveTransactionId(null)} />
      )}

      {/* Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-slate-200 p-2 pb-6 max-w-md mx-auto flex justify-around items-center z-40">
        <button onClick={() => setActiveTab('dashboard')} className={`p-3 rounded-2xl transition duration-300 flex flex-col items-center gap-1 ${activeTab === 'dashboard' ? 'bg-emerald-100 text-emerald-800' : 'text-slate-400 hover:bg-slate-50'}`}>
          <List className="w-6 h-6" />
          <span className="text-[10px] font-bold">Home</span>
        </button>
        <button onClick={() => setActiveTab('market')} className={`p-3 rounded-2xl transition duration-300 flex flex-col items-center gap-1 ${activeTab === 'market' ? 'bg-emerald-100 text-emerald-800' : 'text-slate-400 hover:bg-slate-50'}`}>
          <Store className="w-6 h-6" />
          <span className="text-[10px] font-bold">Market</span>
        </button>
        <button onClick={() => setActiveTab('create')} className="p-4 bg-emerald-600 text-white rounded-full shadow-lg shadow-emerald-600/30 transform -translate-y-6 hover:scale-105 transition active:scale-95">
          <Plus className="w-7 h-7" />
        </button>
        <button onClick={() => setActiveTab('wallet')} className={`p-3 rounded-2xl transition duration-300 flex flex-col items-center gap-1 ${activeTab === 'wallet' ? 'bg-emerald-100 text-emerald-800' : 'text-slate-400 hover:bg-slate-50'}`}>
          <Wallet className="w-6 h-6" />
          <span className="text-[10px] font-bold">Wallet</span>
        </button>
        <button onClick={() => setSetupNeeded(true)} className="p-3 rounded-2xl text-slate-400 hover:bg-slate-50 flex flex-col items-center gap-1">
          <User className="w-6 h-6" />
          <span className="text-[10px] font-bold">Profile</span>
        </button>
      </div>

    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
