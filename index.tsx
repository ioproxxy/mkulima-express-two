
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
  Send
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
      <Loader2 className="w-10 h-10 text-green-600 animate-spin" />
      <p className="text-slate-500 text-sm font-medium">Securing connection...</p>
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
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 shadow-sm">
        <h2 className="text-xl font-bold text-yellow-800 flex items-center gap-2 mb-4">
          <AlertTriangle className="w-6 h-6" />
          System Update Required
        </h2>
        <p className="text-yellow-700 mb-4 text-sm leading-relaxed">
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
            {copied ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Copy SQL'}
          </button>
        </div>
        <button 
          onClick={() => window.location.reload()}
          className="mt-6 w-full bg-yellow-600 text-white py-3 rounded-lg font-semibold hover:bg-yellow-700 transition shadow-md active:scale-[0.98]"
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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md p-8 rounded-2xl shadow-xl border border-slate-100">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4 text-green-600">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Mkulima Express</h1>
          <p className="text-slate-500 text-center mt-2">Trusted Escrow for Farmers & Vendors</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input 
              type="email" 
              required
              className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-green-500 outline-none transition"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input 
              type="password" 
              required
              className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-green-500 outline-none transition"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {!isLogin && (
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRole('vendor')}
                className={`p-3 rounded-lg border-2 flex flex-col items-center justify-center gap-2 transition ${role === 'vendor' ? 'border-green-500 bg-green-50 text-green-700' : 'border-slate-200 text-slate-500'}`}
              >
                <Store className="w-5 h-5" />
                <span className="text-sm font-semibold">Vendor</span>
              </button>
              <button
                type="button"
                onClick={() => setRole('farmer')}
                className={`p-3 rounded-lg border-2 flex flex-col items-center justify-center gap-2 transition ${role === 'farmer' ? 'border-green-500 bg-green-50 text-green-700' : 'border-slate-200 text-slate-500'}`}
              >
                <Sprout className="w-5 h-5" />
                <span className="text-sm font-semibold">Farmer</span>
              </button>
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold shadow-lg shadow-green-600/20 transition active:scale-[0.98]"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : (isLogin ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        <p className="text-center mt-6 text-slate-500 text-sm">
          {isLogin ? "New to Mkulima Express? " : "Already have an account? "}
          <button onClick={() => setIsLogin(!isLogin)} className="text-green-600 font-semibold hover:underline">
            {isLogin ? 'Sign Up' : 'Log In'}
          </button>
        </p>
      </div>
    </div>
  );
};

// 4. Status Helpers
const StatusBadge = ({ status }: { status: TransactionStatus }) => {
  const styles = {
    listed: 'bg-green-100 text-green-700 border-green-200',
    offer_made: 'bg-orange-50 text-orange-600 border-orange-200',
    pending_deposit: 'bg-yellow-50 text-yellow-600 border-yellow-200',
    in_escrow: 'bg-blue-50 text-blue-600 border-blue-200',
    shipped: 'bg-indigo-50 text-indigo-600 border-indigo-200',
    delivered: 'bg-purple-50 text-purple-600 border-purple-200',
    completed: 'bg-slate-100 text-slate-600 border-slate-200',
    disputed: 'bg-red-50 text-red-600 border-red-200',
  };

  const labels = {
    listed: 'Listed',
    offer_made: 'Offer Made',
    pending_deposit: 'Accepted',
    in_escrow: 'In Escrow',
    shipped: 'In Transit',
    delivered: 'Delivered',
    completed: 'Completed',
    disputed: 'Disputed',
  };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${styles[status]}`}>
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
    <div className="flex items-center justify-between mb-8 relative">
      <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-slate-200 -z-10"></div>
      {stages.map((stage, idx) => {
        const isCompleted = idx <= currentIdx;
        const isCurrent = idx === currentIdx;
        return (
          <div key={stage} className={`flex flex-col items-center gap-1 bg-white px-1 ${status === 'disputed' && idx >= currentIdx ? 'opacity-50' : ''}`}>
            <div className={`w-3 h-3 rounded-full border-2 ${isCompleted ? 'bg-green-600 border-green-600' : 'bg-white border-slate-300'}`}></div>
            <span className={`text-[10px] font-bold uppercase ${isCurrent ? 'text-green-700' : 'text-slate-400'}`}>
              {stage === 'pending_deposit' ? 'Agree' : stage.replace('_', ' ')}
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
    <div className="flex flex-col h-[400px] bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && <p className="text-center text-slate-400 text-sm mt-10">No messages yet. Start discussing!</p>}
        {messages.map(msg => {
          const isMe = msg.sender_id === userId;
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-xl p-3 text-sm ${isMe ? 'bg-green-600 text-white rounded-tr-none' : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'}`}>
                <p className="font-bold text-[10px] opacity-70 mb-1">{isMe ? 'You' : msg.sender_email}</p>
                <p>{msg.content}</p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-3 bg-white border-t border-slate-200 flex gap-2">
        <input 
          className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          placeholder="Type a message..."
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
        />
        <button onClick={sendMessage} className="bg-green-600 text-white p-2 rounded-lg hover:bg-green-700 transition">
          <Send className="w-4 h-4" />
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

  return <div id="reader" className="w-full h-64 bg-slate-100 rounded-lg overflow-hidden"></div>;
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
        <h2 className="text-xl font-bold mb-6 text-slate-800">
          {isFarmer ? 'List Produce' : 'Create Escrow Request'}
        </h2>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Produce Name</label>
            <input 
              className="w-full mt-1 p-3 border rounded-lg bg-slate-50 focus:bg-white transition"
              placeholder={isFarmer ? "e.g. 500kg Potatoes" : "e.g. Request for Maize"}
              value={formData.title}
              onChange={e => setFormData({...formData, title: e.target.value})}
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Price ({isFarmer ? 'Listing' : 'Offer'}) (KES)</label>
            <input 
              type="number"
              className="w-full mt-1 p-3 border rounded-lg bg-slate-50 focus:bg-white transition"
              placeholder="0.00"
              value={formData.amount}
              onChange={e => setFormData({...formData, amount: e.target.value})}
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Description</label>
            <textarea 
              className="w-full mt-1 p-3 border rounded-lg bg-slate-50 focus:bg-white transition h-32"
              placeholder="Details about quality, location, delivery terms..."
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
            />
          </div>
          <button 
            onClick={() => createListing(formData)}
            className="w-full bg-green-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-green-600/20 active:scale-95 transition"
          >
            {isFarmer ? 'List to Market' : 'Create Request'}
          </button>
          <button onClick={() => setView('list')} className="w-full text-slate-500 py-2">Cancel</button>
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
            <input type="number" value={offerPrice} onChange={(e) => setOfferPrice(e.target.value)} className="w-full p-3 border rounded-lg" placeholder="Offer Amount" />
            <button onClick={() => makeOffer(selectedTx.id, Number(offerPrice))} className="w-full bg-green-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2">
              <ShoppingBag className="w-5 h-5" /> Make Offer
            </button>
          </div>
        );
      } else if (isSeller) statusMessage = "Listed on Marketplace. Waiting for offers.";
    }
    else if (selectedTx.status === 'offer_made') {
      if (isSeller) {
         primaryAction = (
           <div className="space-y-2">
             <div className="bg-orange-50 p-3 rounded-lg text-orange-800 text-sm mb-2 border border-orange-100">
               Vendor offered <strong>KES {selectedTx.amount}</strong>. Accept?
             </div>
             <button onClick={() => updateStatus(selectedTx.id, 'pending_deposit')} className="w-full bg-green-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2">
               <CheckCircle className="w-5 h-5" /> Accept Offer
             </button>
           </div>
         );
      } else statusMessage = "Offer sent. Waiting for Farmer to accept.";
    }
    else if (selectedTx.status === 'pending_deposit') {
       if (isBuyer) {
         primaryAction = (
           <button onClick={() => fundEscrow(selectedTx)} className="w-full bg-green-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2">
             <Lock className="w-5 h-5" /> Pay KES {selectedTx.amount} to Escrow
           </button>
         );
       } else statusMessage = "Waiting for Vendor to deposit funds...";
    } 
    else if (selectedTx.status === 'in_escrow') {
      if (isSeller) {
        primaryAction = (
          <button onClick={() => updateStatus(selectedTx.id, 'shipped')} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2">
            <Truck className="w-5 h-5" /> Mark as Shipped
          </button>
        );
      } else statusMessage = "Funds Secured in Escrow. Waiting for shipment...";
    } 
    else if (selectedTx.status === 'shipped') {
      if (isSeller) {
         // Show QR Code
         primaryAction = (
           <div className="flex flex-col items-center p-4 bg-white rounded-xl border border-dashed border-slate-300">
             <p className="text-sm font-bold text-slate-700 mb-3">Show to Vendor for Delivery</p>
             <div className="bg-white p-2 rounded-lg border">
               <QRCode value={selectedTx.delivery_pin || selectedTx.id} size={150} />
             </div>
             <p className="mt-3 text-xs text-slate-400 font-mono">PIN: {selectedTx.delivery_pin}</p>
           </div>
         );
      } else if (isBuyer) {
         // Scan QR Code
         primaryAction = (
           <div className="space-y-4">
             {!scanMode ? (
               <button onClick={() => setScanMode(true)} className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2">
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
                 <button onClick={() => setScanMode(false)} className="w-full text-slate-500 py-2">Cancel Scan</button>
               </div>
             )}
             <div className="flex gap-2">
               <input 
                  placeholder="Or enter PIN manually" 
                  className="flex-1 p-3 border rounded-lg text-sm"
                  value={manualPin}
                  onChange={e => setManualPin(e.target.value)}
                />
               <button 
                  onClick={() => confirmDelivery(selectedTx, manualPin)}
                  className="bg-slate-200 text-slate-800 px-4 rounded-lg font-bold"
               >OK</button>
             </div>
           </div>
         );
      }
    }
    else if (selectedTx.status === 'delivered') {
      if (isBuyer) {
        primaryAction = (
          <button onClick={() => releaseFunds(selectedTx)} className="w-full bg-green-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2">
            <Wallet className="w-5 h-5" /> Release Payment
          </button>
        );
      } else statusMessage = "Delivered! Waiting for Vendor to release funds.";
    }
    else if (selectedTx.status === 'disputed') {
      statusMessage = "Transaction Disputed. Funds Frozen.";
      primaryAction = (
        <button onClick={() => updateStatus(selectedTx.id, 'in_escrow')} className="w-full bg-red-100 text-red-600 py-3 rounded-xl font-bold flex items-center justify-center gap-2">
          Resolve Dispute (Reset to In Escrow)
        </button>
      );
    }

    return (
      <div className="p-4 pb-24 max-w-lg mx-auto">
        <button onClick={() => setView('list')} className="mb-4 text-slate-500 hover:text-slate-800 flex items-center gap-1 font-medium">
           <ChevronRight className="w-4 h-4 rotate-180" /> Back
        </button>
        
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          {/* Header */}
          <div className="p-6 bg-slate-900 text-white">
            <h2 className="text-2xl font-bold">{selectedTx.title}</h2>
            <div className="flex justify-between items-end mt-2">
              <div className="text-3xl font-mono text-green-400">KES {selectedTx.amount}</div>
              <StatusBadge status={selectedTx.status} />
            </div>
          </div>
          
          {/* Tabs */}
          <div className="flex border-b border-slate-100">
             <button 
               onClick={() => setTab('info')}
               className={`flex-1 py-3 text-sm font-bold transition ${tab === 'info' ? 'text-green-600 border-b-2 border-green-600' : 'text-slate-400'}`}
             >
               Details
             </button>
             <button 
               onClick={() => setTab('chat')}
               className={`flex-1 py-3 text-sm font-bold transition flex items-center justify-center gap-2 ${tab === 'chat' ? 'text-green-600 border-b-2 border-green-600' : 'text-slate-400'}`}
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
                     className="w-full border border-red-200 text-red-500 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 hover:bg-red-50"
                   >
                     <AlertTriangle className="w-4 h-4" /> Raise Dispute
                   </button>
                )}

                <div className="space-y-2">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Terms</h3>
                  <p className="text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-lg border border-slate-100 text-sm">
                    {selectedTx.description || "No description provided."}
                  </p>
                </div>

                {primaryAction}
                {statusMessage && <div className="text-center text-slate-500 italic p-4 bg-slate-50 rounded-lg">{statusMessage}</div>}
                
                {selectedTx.status === 'completed' && (
                  <div className="text-center text-green-600 font-bold flex items-center justify-center gap-2 bg-green-50 p-4 rounded-lg">
                    <CheckCircle className="w-5 h-5" /> Transaction Completed
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
      <div className="p-4 pb-24 max-w-lg mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">My Wallet</h1>
        
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white shadow-xl mb-6 relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-slate-400 text-sm font-medium mb-1">Available Balance</p>
            <h2 className="text-4xl font-bold mb-6">KES {wallet?.balance.toLocaleString() ?? '0.00'}</h2>
            <div className="flex gap-3">
              <button 
                onClick={topUpWallet}
                className="bg-green-500 hover:bg-green-400 text-slate-900 px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition"
              >
                <Plus className="w-4 h-4" /> Top Up
              </button>
              <button className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg font-bold text-sm transition">
                Withdraw
              </button>
            </div>
          </div>
          <div className="absolute -right-4 -bottom-10 opacity-10">
            <Wallet className="w-48 h-48" />
          </div>
        </div>

        <h3 className="font-bold text-slate-800 mb-4">Transaction History</h3>
        {myHistory.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-8">No completed transactions yet.</p>
        ) : (
          <div className="space-y-3">
             {myHistory.map(tx => {
               const isCredit = userRole === 'farmer' && tx.status === 'completed';
               const isDebit = userRole === 'vendor' && ['in_escrow', 'completed'].includes(tx.status);
               
               if (!isCredit && !isDebit) return null; // Only show realized movements

               return (
                 <div key={tx.id} className="bg-white p-4 rounded-xl border border-slate-100 flex justify-between items-center">
                   <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isCredit ? 'bg-green-100 text-green-600' : 'bg-red-50 text-red-500'}`}>
                        {isCredit ? <ArrowRightLeft className="w-5 h-5 rotate-45" /> : <ArrowRightLeft className="w-5 h-5 -rotate-45" />}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{tx.title}</p>
                        <p className="text-slate-400 text-xs">{new Date(tx.created_at).toLocaleDateString()}</p>
                      </div>
                   </div>
                   <span className={`font-mono font-bold ${isCredit ? 'text-green-600' : 'text-slate-800'}`}>
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
      <div className="p-4 pb-24 max-w-lg mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Marketplace</h1>

        {/* Market Insights */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
             <TrendingUp className="w-5 h-5 text-green-600" />
             <h3 className="font-bold text-slate-800">Market Trends (Avg Price)</h3>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {insights.length > 0 ? insights.map((item, idx) => (
              <div key={idx} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm text-center">
                <p className="text-xs text-slate-500 font-bold uppercase truncate">{item.name}</p>
                <p className="text-lg font-bold text-slate-800 mt-1">KES {item.avg}</p>
              </div>
            )) : (
              <div className="col-span-3 text-center text-slate-400 text-xs italic py-2">Not enough data yet</div>
            )}
          </div>
        </div>

        <h3 className="font-bold text-slate-800 mb-4">
          {userRole === 'vendor' ? 'Fresh Produce Listings' : 'Offers for You'}
        </h3>
        
        {availableItems.length === 0 ? (
           <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200">
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
                className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition cursor-pointer active:scale-[0.99]"
              >
                <div className="flex justify-between items-start mb-2">
                  <StatusBadge status={tx.status} />
                  <span className="font-bold text-lg text-slate-900">KES {tx.amount}</span>
                </div>
                <h3 className="font-bold text-slate-800 text-lg mb-1">{tx.title}</h3>
                <p className="text-slate-500 text-sm line-clamp-2 mb-4">{tx.description}</p>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                   <User className="w-3 h-3" />
                   {userRole === 'vendor' ? tx.farmer_email : tx.vendor_email}
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
      <div className="p-4 pb-24 max-w-lg mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
             <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
             <p className="text-slate-500 text-sm">Welcome, {userRole === 'farmer' ? 'Farmer' : 'Vendor'}</p>
          </div>
          <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center text-slate-600">
             <User className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-green-600 p-6 rounded-2xl text-white shadow-lg shadow-green-600/20 mb-8 flex justify-between items-center cursor-pointer active:scale-[0.98] transition" onClick={() => setView('wallet')}>
           <div>
             <p className="text-green-100 text-sm font-medium">Wallet Balance</p>
             <p className="text-3xl font-bold mt-1">KES {wallet?.balance.toLocaleString() ?? '...'}</p>
           </div>
           <div className="bg-white/20 p-2 rounded-lg">
             <Wallet className="w-6 h-6 text-white" />
           </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-800">Recent Activity</h3>
        </div>

        {myTransactions.length === 0 ? (
          <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
             <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
               <List className="w-6 h-6" />
             </div>
             <p className="text-slate-500 font-medium">No active transactions</p>
          </div>
        ) : (
          <div className="space-y-3">
            {myTransactions.map(tx => (
              <div 
                key={tx.id} 
                onClick={() => { setSelectedTx(tx); setView('details'); }}
                className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm active:scale-[0.99] transition flex justify-between items-center cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.status === 'completed' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-600'}`}>
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">{tx.title}</h4>
                    <p className="text-slate-500 text-xs mt-0.5">{new Date(tx.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="font-mono font-bold text-slate-800">KES {tx.amount}</span>
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
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {view === 'list' && <ListView />}
      {view === 'create' && <CreateForm />}
      {view === 'details' && <Details />}
      {view === 'marketplace' && <MarketplaceView />}
      {view === 'wallet' && <WalletView />}

      {/* Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-2 py-2 flex justify-around items-center z-50 safe-area-bottom shadow-[0_-5px_15px_rgba(0,0,0,0.05)]">
        <button 
          onClick={() => setView('list')}
          className={`flex flex-col items-center gap-1 p-2 min-w-[60px] ${view === 'list' ? 'text-green-600' : 'text-slate-400'}`}
        >
          <List className="w-6 h-6" />
          <span className="text-[10px] font-medium">Home</span>
        </button>

        <button 
          onClick={() => setView('marketplace')}
          className={`flex flex-col items-center gap-1 p-2 min-w-[60px] ${view === 'marketplace' ? 'text-green-600' : 'text-slate-400'}`}
        >
          <Search className="w-6 h-6" />
          <span className="text-[10px] font-medium">Market</span>
        </button>

        <button 
          onClick={() => setView('create')}
          className="flex flex-col items-center justify-center -mt-8"
        >
          <div className="w-14 h-14 bg-green-600 rounded-full shadow-xl shadow-green-600/30 flex items-center justify-center text-white active:scale-95 transition border-4 border-slate-50">
            <Plus className="w-7 h-7" />
          </div>
          <span className="text-[10px] font-medium text-slate-500 mt-1">Post</span>
        </button>

        <button 
          onClick={() => setView('wallet')}
          className={`flex flex-col items-center gap-1 p-2 min-w-[60px] ${view === 'wallet' ? 'text-green-600' : 'text-slate-400'}`}
        >
          <Wallet className="w-6 h-6" />
          <span className="text-[10px] font-medium">Wallet</span>
        </button>

        <button 
           onClick={async () => {
             await supabase.auth.signOut();
             setSession(null);
           }}
           className="flex flex-col items-center gap-1 p-2 min-w-[60px] text-slate-400 hover:text-red-500 transition"
        >
          <LogOut className="w-6 h-6" />
          <span className="text-[10px] font-medium">Log Out</span>
        </button>
      </div>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
