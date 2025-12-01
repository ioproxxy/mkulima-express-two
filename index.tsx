
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
  Leaf
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
  delivery_pin text default substring(md5(random()::text) from 0 for 7) -- 6 char PIN
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

-- 4. MIGRATION: Ensure vendor_id is nullable
alter table public.escrow_transactions alter column vendor_id drop not null;
-- Ensure delivery_pin exists if table was already created
do $$ 
begin 
  if not exists (select 1 from information_schema.columns where table_name='escrow_transactions' and column_name='delivery_pin') then
    alter table public.escrow_transactions add column delivery_pin text default substring(md5(random()::text) from 0 for 7);
  end if;
end $$;

-- 5. Enable RLS
alter table public.wallets enable row level security;
alter table public.escrow_transactions enable row level security;
alter table public.messages enable row level security;

-- 6. Policies (Re-runnable)
drop policy if exists "Access own wallet" on public.wallets;
drop policy if exists "Access transactions" on public.escrow_transactions;
drop policy if exists "Access messages" on public.messages;

create policy "Access own wallet" on public.wallets for all using (auth.uid() = user_id);

create policy "Access transactions" on public.escrow_transactions for all using (auth.role() = 'authenticated');

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
          <AlertTriangle className="w-6 h-6" />
          System Update Required
        </h2>
        <p className="text-amber-700 mb-4 text-sm leading-relaxed">
          To enable <strong>Chat, Logistics, and Dispute Resolution</strong>, please run this SQL in your Supabase dashboard.
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

// 3. Auth Component
const Auth = ({ onLogin }: { onLogin: () => void }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('vendor');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { role },
          },
        });
        if (error) throw error;
      }
      onLogin();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="bg-white w-full max-w-md p-8 rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-100">
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 bg-emerald-50 rounded-2xl flex items-center justify-center mb-5 shadow-sm border border-emerald-100 transform rotate-3 hover:rotate-0 transition duration-300">
            {/* Logo Placeholder - You can replace this Sprout with an <img> tag */}
             <div className="relative">
                <Sprout className="w-10 h-10 text-emerald-600 absolute -top-1 -left-1 opacity-20" />
                <Sprout className="w-10 h-10 text-emerald-700 relative z-10" />
             </div>
          </div>
          <h1 className="text-3xl font-extrabold text-emerald-950 tracking-tight">Mkulima Express</h1>
          <p className="text-slate-500 text-center mt-2 font-medium">Trusted Escrow for Farmers & Vendors</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 text-sm flex items-start gap-3 border border-red-100">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">Email Address</label>
            <input 
              type="email" 
              required
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition font-medium text-slate-800"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">Password</label>
            <input 
              type="password" 
              required
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition font-medium text-slate-800"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {!isLogin && (
            <div className="grid grid-cols-2 gap-4 mt-2">
              <button
                type="button"
                onClick={() => setRole('vendor')}
                className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition duration-200 ${role === 'vendor' ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'}`}
              >
                <Store className="w-6 h-6" />
                <span className="text-sm font-bold">Vendor</span>
              </button>
              <button
                type="button"
                onClick={() => setRole('farmer')}
                className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition duration-200 ${role === 'farmer' ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'}`}
              >
                <Sprout className="w-6 h-6" />
                <span className="text-sm font-bold">Farmer</span>
              </button>
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-emerald-700 hover:bg-emerald-800 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-emerald-700/30 transition active:scale-[0.98] mt-4"
          >
            {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : (isLogin ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        <p className="text-center mt-8 text-slate-500 text-sm">
          {isLogin ? "New to Mkulima Express? " : "Already have an account? "}
          <button onClick={() => setIsLogin(!isLogin)} className="text-emerald-700 font-bold hover:underline transition">
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
    listed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    offer_made: 'bg-orange-100 text-orange-800 border-orange-200',
    pending_deposit: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    in_escrow: 'bg-blue-100 text-blue-800 border-blue-200',
    shipped: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    delivered: 'bg-purple-100 text-purple-800 border-purple-200',
    completed: 'bg-slate-100 text-slate-600 border-slate-200',
    disputed: 'bg-red-100 text-red-800 border-red-200',
  };

  const labels = {
    listed: 'Listed',
    offer_made: 'Offer Received',
    pending_deposit: 'Accepted',
    in_escrow: 'Secured in Escrow',
    shipped: 'On The Way',
    delivered: 'Delivered',
    completed: 'Completed',
    disputed: 'Disputed',
  };

  return (
    <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide border ${styles[status]} shadow-sm`}>
      {labels[status]}
    </span>
  );
};

// Timeline Component
const Timeline = ({ status }: { status: TransactionStatus }) => {
  const stages: TransactionStatus[] = ['listed', 'pending_deposit', 'in_escrow', 'shipped', 'delivered', 'completed'];
  
  // Map simplified stages for UI
  const currentIdx = stages.indexOf(status) === -1 ? 
    (status === 'offer_made' ? 0 : (status === 'disputed' ? 2 : 5)) 
    : stages.indexOf(status);

  return (
    <div className="flex items-center justify-between mb-8 relative px-2">
      <div className="absolute left-2 right-2 top-[14px] h-1 bg-slate-100 -z-10 rounded-full"></div>
      <div className="absolute left-2 top-[14px] h-1 bg-emerald-500 -z-10 rounded-full transition-all duration-500" style={{ width: `${(currentIdx / (stages.length - 1)) * 100}%` }}></div>
      
      {stages.map((stage, idx) => {
        const isCompleted = idx <= currentIdx;
        const isCurrent = idx === currentIdx;
        return (
          <div key={stage} className={`flex flex-col items-center gap-2 ${status === 'disputed' && idx >= currentIdx ? 'opacity-50' : ''}`}>
            <div className={`w-8 h-8 rounded-full border-[3px] flex items-center justify-center transition-all duration-300 shadow-sm ${isCompleted ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-200 text-transparent'}`}>
              <CheckCircle className="w-4 h-4" />
            </div>
            <span className={`text-[9px] font-bold uppercase tracking-wider ${isCurrent ? 'text-emerald-800' : 'text-slate-300'}`}>
              {stage === 'pending_deposit' ? 'Agreed' : stage.replace('_', ' ')}
            </span>
          </div>
        );
      })}
    </div>
  );
};

// 5. Chat Component
const ChatBox = ({ txId, userId, userEmail }: { txId: string, userId: string, userEmail: string }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('transaction_id', txId)
      .order('created_at', { ascending: true });
    if (data) setMessages(data);
  };

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000); // Poll for updates
    return () => clearInterval(interval);
  }, [txId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    const { error } = await supabase.from('messages').insert({
      transaction_id: txId,
      sender_id: userId,
      sender_email: userEmail,
      content: newMessage
    });
    if (!error) {
      setNewMessage('');
      fetchMessages();
    }
  };

  return (
    <div className="flex flex-col h-[500px] bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="bg-white p-3 border-b border-slate-100 text-center text-xs font-bold text-slate-400 uppercase tracking-wide">
        Secure Chat
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
           <div className="text-center mt-12 opacity-50">
             <MessageCircle className="w-12 h-12 text-slate-300 mx-auto mb-2" />
             <p className="text-slate-400 text-sm">Start the conversation</p>
           </div>
        )}
        {messages.map(msg => {
          const isMe = msg.sender_id === userId;
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl p-3 text-sm shadow-sm ${isMe ? 'bg-emerald-600 text-white rounded-tr-sm' : 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm'}`}>
                {!isMe && <p className="font-bold text-[10px] text-emerald-600 mb-1">{msg.sender_email?.split('@')[0]}</p>}
                <p className="leading-relaxed">{msg.content}</p>
                <p className={`text-[9px] mt-1 text-right opacity-70 ${isMe ? 'text-emerald-100' : 'text-slate-400'}`}>
                  {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-3 bg-white border-t border-slate-200 flex gap-2">
        <input 
          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
          placeholder="Type a message..."
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
        />
        <button onClick={sendMessage} className="bg-emerald-600 text-white p-3 rounded-xl hover:bg-emerald-700 transition shadow-md shadow-emerald-600/20 active:scale-95">
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

// 6. QR Scanner Component
const QRScanner = ({ onScan }: { onScan: (data: string) => void }) => {
  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "reader",
      { fps: 10, qrbox: { width: 250, height: 250 } },
      false
    );
    scanner.render((decodedText) => {
      onScan(decodedText);
      scanner.clear();
    }, (err) => console.warn(err));

    return () => {
      scanner.clear().catch(e => console.error("Failed to clear scanner", e));
    };
  }, []);

  return <div id="reader" className="w-full h-64 bg-slate-100 rounded-xl overflow-hidden shadow-inner"></div>;
};

// 7. Main App Logic
const App = () => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [view, setView] = useState<'list' | 'create' | 'details' | 'marketplace' | 'wallet'>('list');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [tab, setTab] = useState<'info' | 'chat'>('info');

  // Initial Data Load
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        setUserRole(session.user.user_metadata.role || 'vendor');
        fetchInitialData(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        setUserRole(session.user.user_metadata.role || 'vendor');
        fetchInitialData(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchInitialData = async (userId: string) => {
    setLoading(true);
    await Promise.all([fetchTransactions(), fetchWallet(userId)]);
    setLoading(false);
  };

  const fetchTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from('escrow_transactions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === '42P01') setNeedsSetup(true);
        else console.error('Error fetching transactions:', error);
      } else {
        setTransactions(data || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchWallet = async (userId: string) => {
    try {
      let { data, error } = await supabase.from('wallets').select('*').eq('user_id', userId).single();
      
      if (error && error.code === 'PGRST116') {
        const { data: newData, error: createError } = await supabase
          .from('wallets')
          .insert({ user_id: userId, balance: 2000 })
          .select()
          .single();
        if (createError) throw createError;
        data = newData;
      } else if (error && error.code === '42P01') {
        setNeedsSetup(true);
        return;
      }

      setWallet(data);
    } catch (e) {
      console.error("Wallet fetch error:", e);
    }
  };

  // --- Actions ---

  const createListing = async (formData: any) => {
    if (!session) return;
    setLoading(true);
    try {
      const isFarmer = userRole === 'farmer';
      const payload: any = {
        title: formData.title,
        amount: formData.amount,
        description: formData.description,
        status: isFarmer ? 'listed' : 'pending_deposit',
      };

      if (isFarmer) {
        payload.farmer_id = session.user.id;
        payload.farmer_email = session.user.email;
      } else {
        payload.vendor_id = session.user.id;
        payload.vendor_email = session.user.email;
      }

      const { error } = await supabase.from('escrow_transactions').insert(payload);
      if (error) throw error;
      
      setView('list');
      fetchTransactions();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  const makeOffer = async (id: string, offerAmount: number) => {
    if (!session) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('escrow_transactions')
        .update({ 
          vendor_id: session.user.id,
          vendor_email: session.user.email,
          amount: offerAmount,
          status: 'offer_made'
        })
        .eq('id', id);
      
      if (error) throw error;
      
      const updated = { ...transactions.find(t => t.id === id)!, status: 'offer_made' as TransactionStatus, amount: offerAmount, vendor_id: session.user.id, vendor_email: session.user.email };
      setTransactions(prev => prev.map(t => t.id === id ? updated : t));
      setSelectedTx(updated);
      
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, newStatus: TransactionStatus) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('escrow_transactions')
        .update({ status: newStatus })
        .eq('id', id);
      
      if (error) throw error;
      
      setTransactions(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t));
      if (selectedTx) setSelectedTx({ ...selectedTx!, status: newStatus });
      
    } catch (e: any) {
      alert('Action failed: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const fundEscrow = async (tx: Transaction) => {
    if (!wallet || wallet.balance < tx.amount) {
      alert("Insufficient wallet balance! Please top up.");
      return;
    }
    setLoading(true);
    try {
      const { error: walletError } = await supabase
        .from('wallets')
        .update({ balance: wallet.balance - tx.amount })
        .eq('user_id', session.user.id);
      
      if (walletError) throw walletError;

      const { error: txError } = await supabase
        .from('escrow_transactions')
        .update({ status: 'in_escrow' })
        .eq('id', tx.id);
      
      if (txError) throw txError;

      fetchWallet(session.user.id);
      setTransactions(prev => prev.map(t => t.id === tx.id ? { ...t, status: 'in_escrow' } : t));
      if (selectedTx) setSelectedTx({ ...selectedTx!, status: 'in_escrow' });

    } catch (e: any) {
      alert("Funding failed: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const confirmDelivery = async (tx: Transaction, pin?: string) => {
    if (tx.delivery_pin && pin && tx.delivery_pin !== pin) {
       alert("Invalid Delivery PIN or QR Code");
       return;
    }

    await updateStatus(tx.id, 'delivered');
  };

  const releaseFunds = async (tx: Transaction) => {
    setLoading(true);
    try {
      if (!tx.farmer_id) throw new Error("No farmer ID found");
      
      const { error: txError } = await supabase
        .from('escrow_transactions')
        .update({ status: 'completed' })
        .eq('id', tx.id);
      
      if (txError) throw txError;

      const { data: farmerWallet } = await supabase.from('wallets').select('balance').eq('user_id', tx.farmer_id).single();
      if (farmerWallet) {
        await supabase.from('wallets').update({ balance: farmerWallet.balance + tx.amount }).eq('user_id', tx.farmer_id);
      }

      setTransactions(prev => prev.map(t => t.id === tx.id ? { ...t, status: 'completed' } : t));
      if (selectedTx) setSelectedTx({ ...selectedTx!, status: 'completed' });

    } catch (e: any) {
      alert("Release failed: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const topUpWallet = async () => {
    if (!wallet) return;
    setLoading(true);
    try {
      const newBalance = wallet.balance + 1000;
      const { error } = await supabase
        .from('wallets')
        .update({ balance: newBalance })
        .eq('user_id', session.user.id);
      
      if (error) throw error;
      setWallet({ ...wallet, balance: newBalance });
    } catch (e: any) {
      alert("Top up failed");
    } finally {
      setLoading(false);
    }
  };

  // --- Views ---

  if (loading && !transactions.length && !needsSetup) return <Loading />;
  if (needsSetup) return <SetupRequired />;
  if (!session) return <Auth onLogin={() => {}} />;

  // Create Form
  const CreateForm = () => {
    const [formData, setFormData] = useState({ title: '', amount: '', description: '' });
    const isFarmer = userRole === 'farmer';
    
    return (
      <div className="p-4 max-w-lg mx-auto pb-24">
        <h2 className="text-xl font-bold mb-6 text-emerald-950 flex items-center gap-2">
          {isFarmer ? <Sprout className="w-6 h-6 text-emerald-600" /> : <ShoppingBag className="w-6 h-6 text-emerald-600" />}
          {isFarmer ? 'List Produce' : 'Create Request'}
        </h2>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-5">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Produce Name</label>
            <input 
              className="w-full mt-2 p-4 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition"
              placeholder={isFarmer ? "e.g. 500kg Potatoes" : "e.g. Request for Maize"}
              value={formData.title}
              onChange={e => setFormData({...formData, title: e.target.value})}
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Price ({isFarmer ? 'Listing' : 'Offer'}) (KES)</label>
            <div className="relative mt-2">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">KES</span>
              <input 
                type="number"
                className="w-full p-4 pl-14 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition font-mono"
                placeholder="0.00"
                value={formData.amount}
                onChange={e => setFormData({...formData, amount: e.target.value})}
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Description</label>
            <textarea 
              className="w-full mt-2 p-4 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition h-32"
              placeholder="Details about quality, location, delivery terms..."
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
            />
          </div>
          <button 
            onClick={() => createListing(formData)}
            className="w-full bg-emerald-700 text-white py-4 rounded-xl font-bold shadow-lg shadow-emerald-700/20 active:scale-95 transition text-lg"
          >
            {isFarmer ? 'List to Market' : 'Create Request'}
          </button>
          <button onClick={() => setView('list')} className="w-full text-slate-500 py-3 font-medium hover:text-emerald-700 transition">Cancel</button>
        </div>
      </div>
    );
  };

  // Detail View
  const Details = () => {
    if (!selectedTx) return null;
    const [offerPrice, setOfferPrice] = useState(selectedTx.amount.toString());
    const [scanMode, setScanMode] = useState(false);
    const [manualPin, setManualPin] = useState('');
    
    const isBuyer = session.user.id === selectedTx.vendor_id || (!selectedTx.vendor_id && userRole === 'vendor');
    const isSeller = session.user.id === selectedTx.farmer_id || (!selectedTx.farmer_id && userRole === 'farmer');

    // Action Logic
    let primaryAction = null;
    let statusMessage = null;

    if (selectedTx.status === 'listed') {
      if (userRole === 'vendor') {
        primaryAction = (
          <div className="space-y-3">
            <input type="number" value={offerPrice} onChange={(e) => setOfferPrice(e.target.value)} className="w-full p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="Offer Amount" />
            <button onClick={() => makeOffer(selectedTx.id, Number(offerPrice))} className="w-full bg-emerald-700 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-700/20 active:scale-95 transition">
              <ShoppingBag className="w-5 h-5" /> Make Offer
            </button>
          </div>
        );
      } else if (isSeller) statusMessage = "Listed on Marketplace. Waiting for offers.";
    }
    else if (selectedTx.status === 'offer_made') {
      if (isSeller) {
         primaryAction = (
           <div className="space-y-3">
             <div className="bg-orange-50 p-4 rounded-xl text-orange-900 text-sm mb-2 border border-orange-100 shadow-sm">
               Vendor offered <strong className="text-orange-700">KES {selectedTx.amount}</strong>. Accept?
             </div>
             <button onClick={() => updateStatus(selectedTx.id, 'pending_deposit')} className="w-full bg-emerald-700 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-700/20 active:scale-95 transition">
               <CheckCircle className="w-5 h-5" /> Accept Offer
             </button>
           </div>
         );
      } else statusMessage = "Offer sent. Waiting for Farmer to accept.";
    }
    else if (selectedTx.status === 'pending_deposit') {
       if (isBuyer) {
         primaryAction = (
           <button onClick={() => fundEscrow(selectedTx)} className="w-full bg-emerald-700 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-700/20 active:scale-95 transition">
             <Lock className="w-5 h-5" /> Pay KES {selectedTx.amount} to Escrow
           </button>
         );
       } else statusMessage = "Waiting for Vendor to deposit funds...";
    } 
    else if (selectedTx.status === 'in_escrow') {
      if (isSeller) {
        primaryAction = (
          <button onClick={() => updateStatus(selectedTx.id, 'shipped')} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 active:scale-95 transition">
            <Truck className="w-5 h-5" /> Mark as Shipped
          </button>
        );
      } else statusMessage = "Funds Secured in Escrow. Waiting for shipment...";
    } 
    else if (selectedTx.status === 'shipped') {
      if (isSeller) {
         // Show QR Code
         primaryAction = (
           <div className="flex flex-col items-center p-6 bg-white rounded-3xl border border-dashed border-slate-300 shadow-sm">
             <p className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wide">Show to Vendor for Delivery</p>
             <div className="bg-white p-3 rounded-2xl border shadow-sm">
               <QRCode value={selectedTx.delivery_pin || selectedTx.id} size={180} />
             </div>
             <p className="mt-4 text-xs text-slate-400 font-mono bg-slate-100 px-3 py-1 rounded-full">PIN: {selectedTx.delivery_pin}</p>
           </div>
         );
      } else if (isBuyer) {
         // Scan QR Code
         primaryAction = (
           <div className="space-y-4">
             {!scanMode ? (
               <button onClick={() => setScanMode(true)} className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition">
                 <ScanLine className="w-6 h-6" /> Scan Delivery QR
               </button>
             ) : (
               <div className="space-y-2">
                 <QRScanner onScan={(val) => {
                   if (val === selectedTx.delivery_pin || val === selectedTx.id) {
                     confirmDelivery(selectedTx, selectedTx.delivery_pin);
                     setScanMode(false);
                   } else {
                     alert("Invalid QR Code for this transaction");
                   }
                 }} />
                 <button onClick={() => setScanMode(false)} className="w-full text-slate-500 py-2 font-medium">Cancel Scan</button>
               </div>
             )}
             <div className="flex gap-2">
               <input 
                  placeholder="Or enter PIN manually" 
                  className="flex-1 p-4 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-slate-500 outline-none"
                  value={manualPin}
                  onChange={e => setManualPin(e.target.value)}
                />
               <button 
                  onClick={() => confirmDelivery(selectedTx, manualPin)}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-6 rounded-xl font-bold transition"
               >OK</button>
             </div>
           </div>
         );
      }
    }
    else if (selectedTx.status === 'delivered') {
      if (isBuyer) {
        primaryAction = (
          <button onClick={() => releaseFunds(selectedTx)} className="w-full bg-emerald-700 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-700/20 active:scale-95 transition">
            <Wallet className="w-5 h-5" /> Release Payment
          </button>
        );
      } else statusMessage = "Delivered! Waiting for Vendor to release funds.";
    }
    else if (selectedTx.status === 'disputed') {
      statusMessage = "Transaction Disputed. Funds Frozen.";
      primaryAction = (
        <button onClick={() => updateStatus(selectedTx.id, 'in_escrow')} className="w-full bg-red-50 text-red-600 py-4 rounded-xl font-bold flex items-center justify-center gap-2 border border-red-100 hover:bg-red-100 transition">
          Resolve Dispute (Reset to In Escrow)
        </button>
      );
    }

    return (
      <div className="p-4 pb-28 max-w-lg mx-auto">
        <button onClick={() => setView('list')} className="mb-4 text-slate-500 hover:text-emerald-800 flex items-center gap-1 font-bold text-sm bg-white px-3 py-1.5 rounded-full shadow-sm border border-slate-100 w-fit">
           <ChevronRight className="w-4 h-4 rotate-180" /> Back
        </button>
        
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          {/* Header */}
          <div className="p-6 bg-gradient-to-br from-emerald-900 to-emerald-800 text-white relative overflow-hidden">
            <div className="absolute right-0 top-0 opacity-10 transform translate-x-1/3 -translate-y-1/3">
              <Sprout className="w-32 h-32" />
            </div>
            <h2 className="text-xl font-bold relative z-10">{selectedTx.title}</h2>
            <div className="flex justify-between items-end mt-4 relative z-10">
              <div className="text-3xl font-mono text-emerald-200 font-bold">KES {selectedTx.amount}</div>
              <StatusBadge status={selectedTx.status} />
            </div>
          </div>
          
          {/* Tabs */}
          <div className="flex border-b border-slate-100">
             <button 
               onClick={() => setTab('info')}
               className={`flex-1 py-4 text-sm font-bold transition border-b-2 ${tab === 'info' ? 'text-emerald-700 border-emerald-600' : 'text-slate-400 border-transparent'}`}
             >
               Details
             </button>
             <button 
               onClick={() => setTab('chat')}
               className={`flex-1 py-4 text-sm font-bold transition flex items-center justify-center gap-2 border-b-2 ${tab === 'chat' ? 'text-emerald-700 border-emerald-600' : 'text-slate-400 border-transparent'}`}
             >
               Chat <MessageCircle className="w-4 h-4" />
             </button>
          </div>

          <div className="p-6">
            {tab === 'chat' ? (
              <ChatBox txId={selectedTx.id} userId={session.user.id} userEmail={session.user.email} />
            ) : (
              <div className="space-y-6">
                <Timeline status={selectedTx.status} />

                {/* Dispute Button */}
                {['in_escrow', 'shipped', 'delivered'].includes(selectedTx.status) && (
                   <button 
                     onClick={() => updateStatus(selectedTx.id, 'disputed')}
                     className="w-full border border-red-200 text-red-500 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-red-50 transition"
                   >
                     <AlertTriangle className="w-4 h-4" /> Raise Dispute
                   </button>
                )}

                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Description</h3>
                  <p className="text-slate-700 leading-relaxed bg-slate-50 p-5 rounded-2xl border border-slate-100 text-sm">
                    {selectedTx.description || "No description provided."}
                  </p>
                </div>

                {primaryAction}
                {statusMessage && <div className="text-center text-slate-500 italic p-4 bg-slate-50 rounded-xl text-sm">{statusMessage}</div>}
                
                {selectedTx.status === 'completed' && (
                  <div className="text-center text-emerald-700 font-bold flex items-center justify-center gap-2 bg-emerald-50 p-5 rounded-2xl border border-emerald-100">
                    <CheckCircle className="w-6 h-6" /> Transaction Completed
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Wallet View
  const WalletView = () => {
    const myHistory = transactions.filter(t => 
      (t.status === 'completed' || t.status === 'in_escrow') &&
      (t.vendor_id === session.user.id || t.farmer_id === session.user.id)
    );

    return (
      <div className="p-4 pb-28 max-w-lg mx-auto">
        <h1 className="text-2xl font-extrabold text-emerald-950 mb-6 tracking-tight">My Wallet</h1>
        
        <div className="bg-gradient-to-br from-emerald-800 to-emerald-900 rounded-3xl p-6 text-white shadow-xl shadow-emerald-900/20 mb-8 relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-emerald-200 text-sm font-medium mb-1 uppercase tracking-wide">Available Balance</p>
            <h2 className="text-4xl font-mono font-bold mb-8">KES {wallet?.balance.toLocaleString() ?? '0.00'}</h2>
            <div className="flex gap-3">
              <button 
                onClick={topUpWallet}
                className="bg-white text-emerald-900 px-5 py-3 rounded-xl font-bold text-sm flex items-center gap-2 transition hover:bg-emerald-50 active:scale-95 shadow-lg"
              >
                <Plus className="w-4 h-4" /> Top Up
              </button>
              <button className="bg-emerald-700/50 hover:bg-emerald-700/70 text-white px-5 py-3 rounded-xl font-bold text-sm transition backdrop-blur-sm">
                Withdraw
              </button>
            </div>
          </div>
          <div className="absolute -right-6 -bottom-10 opacity-10 rotate-12">
            <Wallet className="w-48 h-48 text-white" />
          </div>
        </div>

        <h3 className="font-bold text-slate-800 mb-4 text-lg">Transaction History</h3>
        {myHistory.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-8 italic">No completed transactions yet.</p>
        ) : (
          <div className="space-y-3">
             {myHistory.map(tx => {
               const isCredit = userRole === 'farmer' && tx.status === 'completed';
               const isDebit = userRole === 'vendor' && ['in_escrow', 'completed'].includes(tx.status);
               
               if (!isCredit && !isDebit) return null; // Only show realized movements

               return (
                 <div key={tx.id} className="bg-white p-4 rounded-2xl border border-slate-100 flex justify-between items-center shadow-sm">
                   <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isCredit ? 'bg-emerald-100 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                        {isCredit ? <ArrowRightLeft className="w-5 h-5 rotate-45" /> : <ArrowRightLeft className="w-5 h-5 -rotate-45" />}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{tx.title}</p>
                        <p className="text-slate-400 text-xs mt-0.5">{new Date(tx.created_at).toLocaleDateString()}</p>
                      </div>
                   </div>
                   <span className={`font-mono font-bold text-sm ${isCredit ? 'text-emerald-600' : 'text-slate-800'}`}>
                     {isCredit ? '+' : '-'} KES {tx.amount}
                   </span>
                 </div>
               );
             })}
          </div>
        )}
      </div>
    );
  };

  // Marketplace View
  const MarketplaceView = () => {
    // Insights Logic
    const insights = useMemo(() => {
      const groups: Record<string, { total: number, count: number }> = {};
      transactions.forEach(t => {
        const key = t.title.split(' ')[0]; 
        if (!groups[key]) groups[key] = { total: 0, count: 0 };
        groups[key].total += Number(t.amount);
        groups[key].count += 1;
      });
      return Object.entries(groups)
        .map(([name, data]) => ({ name, avg: Math.round(data.total / data.count) }))
        .sort((a, b) => b.avg - a.avg)
        .slice(0, 3);
    }, [transactions]);

    const availableItems = transactions.filter(t => {
      if (userRole === 'vendor') return t.status === 'listed';
      else return t.status === 'offer_made';
    });

    return (
      <div className="p-4 pb-28 max-w-lg mx-auto">
        <h1 className="text-2xl font-extrabold text-emerald-950 mb-6 tracking-tight">Marketplace</h1>

        {/* Market Insights */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
             <TrendingUp className="w-5 h-5 text-emerald-600" />
             <h3 className="font-bold text-slate-800">Market Trends (Avg Price)</h3>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {insights.length > 0 ? insights.map((item, idx) => (
              <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm text-center">
                <p className="text-[10px] text-slate-400 font-bold uppercase truncate tracking-wider">{item.name}</p>
                <p className="text-sm font-bold text-slate-800 mt-1 font-mono">KES {item.avg}</p>
              </div>
            )) : (
              <div className="col-span-3 text-center text-slate-400 text-xs italic py-2">Not enough data yet</div>
            )}
          </div>
        </div>

        <h3 className="font-bold text-slate-800 mb-4 text-lg">
          {userRole === 'vendor' ? 'Fresh Produce Listings' : 'Offers for You'}
        </h3>
        
        {availableItems.length === 0 ? (
           <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-slate-200">
             <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
               <ShoppingBag className="w-8 h-8" />
             </div>
             <p className="text-slate-500 font-medium">No items found</p>
           </div>
        ) : (
          <div className="grid gap-4">
            {availableItems.map(tx => (
              <div 
                key={tx.id}
                onClick={() => { setSelectedTx(tx); setView('details'); }}
                className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition cursor-pointer active:scale-[0.99] group"
              >
                <div className="flex justify-between items-start mb-2">
                  <StatusBadge status={tx.status} />
                  <span className="font-bold text-lg text-emerald-900 group-hover:text-emerald-700 transition font-mono">KES {tx.amount}</span>
                </div>
                <h3 className="font-bold text-slate-800 text-lg mb-1">{tx.title}</h3>
                <p className="text-slate-500 text-sm line-clamp-2 mb-4 leading-relaxed">{tx.description}</p>
                <div className="flex items-center gap-2 text-xs text-slate-400 font-medium bg-slate-50 w-fit px-3 py-1 rounded-full">
                   <User className="w-3 h-3" />
                   {userRole === 'vendor' ? tx.farmer_email?.split('@')[0] : tx.vendor_email?.split('@')[0]}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // List View (My Dashboard)
  const ListView = () => {
    const myTransactions = transactions.filter(t => 
      t.vendor_id === session.user.id || t.farmer_id === session.user.id
    );

    return (
      <div className="p-4 pb-28 max-w-lg mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
             <h1 className="text-2xl font-extrabold text-emerald-950 tracking-tight">Dashboard</h1>
             <p className="text-slate-500 text-sm font-medium">Welcome back, {userRole === 'farmer' ? 'Farmer' : 'Vendor'}</p>
          </div>
          <div className="w-12 h-12 bg-white border border-slate-100 shadow-sm rounded-full flex items-center justify-center text-slate-600">
             <User className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-emerald-600 p-6 rounded-3xl text-white shadow-xl shadow-emerald-600/20 mb-10 flex justify-between items-center cursor-pointer active:scale-[0.98] transition hover:bg-emerald-700 relative overflow-hidden" onClick={() => setView('wallet')}>
           <div className="relative z-10">
             <p className="text-emerald-100 text-xs font-bold uppercase tracking-wider mb-1">Total Balance</p>
             <p className="text-3xl font-bold font-mono">KES {wallet?.balance.toLocaleString() ?? '...'}</p>
           </div>
           <div className="bg-white/10 p-3 rounded-2xl relative z-10 backdrop-blur-sm">
             <Wallet className="w-6 h-6 text-white" />
           </div>
           <Sprout className="absolute -left-4 -bottom-4 text-emerald-500/30 w-32 h-32 rotate-12" />
        </div>

        <div className="flex items-center justify-between mb-4 px-1">
          <h3 className="font-bold text-slate-800 text-lg">Recent Activity</h3>
        </div>

        {myTransactions.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-3xl border border-dashed border-slate-300">
             <div className="w-14 h-14 bg-white shadow-sm rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
               <List className="w-6 h-6" />
             </div>
             <p className="text-slate-500 font-medium">No active transactions</p>
          </div>
        ) : (
          <div className="space-y-4">
            {myTransactions.map(tx => (
              <div 
                key={tx.id} 
                onClick={() => { setSelectedTx(tx); setView('details'); }}
                className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm active:scale-[0.99] transition flex justify-between items-center cursor-pointer hover:border-emerald-100 hover:shadow-md"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${tx.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-500'}`}>
                    {tx.status === 'completed' ? <CheckCircle className="w-6 h-6" /> : <DollarSign className="w-6 h-6" />}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm mb-1">{tx.title}</h4>
                    <p className="text-slate-400 text-xs">{new Date(tx.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className="font-mono font-bold text-slate-800 text-sm">KES {tx.amount}</span>
                  <StatusBadge status={tx.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-emerald-200 selection:text-emerald-900">
      {view === 'list' && <ListView />}
      {view === 'create' && <CreateForm />}
      {view === 'details' && <Details />}
      {view === 'marketplace' && <MarketplaceView />}
      {view === 'wallet' && <WalletView />}

      {/* Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-slate-200 px-6 py-4 flex justify-around items-center z-50 safe-area-bottom shadow-[0_-10px_40px_rgba(0,0,0,0.05)] rounded-t-3xl">
        <button 
          onClick={() => setView('list')}
          className={`flex flex-col items-center gap-1.5 min-w-[60px] transition-colors ${view === 'list' ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <List className={`w-6 h-6 ${view === 'list' ? 'fill-emerald-100' : ''}`} />
          <span className="text-[10px] font-bold tracking-wide">Home</span>
        </button>

        <button 
          onClick={() => setView('marketplace')}
          className={`flex flex-col items-center gap-1.5 min-w-[60px] transition-colors ${view === 'marketplace' ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <Store className={`w-6 h-6 ${view === 'marketplace' ? 'fill-emerald-100' : ''}`} />
          <span className="text-[10px] font-bold tracking-wide">Market</span>
        </button>

        <button 
          onClick={() => setView('create')}
          className="flex flex-col items-center justify-center -mt-10"
        >
          <div className="w-16 h-16 bg-emerald-600 rounded-2xl shadow-xl shadow-emerald-600/40 flex items-center justify-center text-white active:scale-95 transition hover:bg-emerald-700 transform rotate-45 border-4 border-slate-50">
            <Plus className="w-8 h-8 -rotate-45" />
          </div>
          <span className="text-[10px] font-bold text-slate-500 mt-2">Post</span>
        </button>

        <button 
          onClick={() => setView('wallet')}
          className={`flex flex-col items-center gap-1.5 min-w-[60px] transition-colors ${view === 'wallet' ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <Wallet className={`w-6 h-6 ${view === 'wallet' ? 'fill-emerald-100' : ''}`} />
          <span className="text-[10px] font-bold tracking-wide">Wallet</span>
        </button>

        <button 
           onClick={async () => {
             await supabase.auth.signOut();
             setSession(null);
           }}
           className="flex flex-col items-center gap-1.5 min-w-[60px] text-slate-400 hover:text-red-500 transition-colors"
        >
          <LogOut className="w-6 h-6" />
          <span className="text-[10px] font-bold tracking-wide">Log Out</span>
        </button>
      </div>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
