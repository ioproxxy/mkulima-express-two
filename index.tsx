import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import QRCode from 'react-qr-code';
import {
  Wallet, Leaf, CheckCircle, CreditCard,
  LogOut, Home, Store, Plus, User, Loader2, X,
  TrendingUp, ArrowUpRight, ArrowDownRight, Package, Scale,
  Clock, MapPin, Truck, ShieldCheck, AlertCircle, Search,
  ChevronRight, MessageSquare, Bell, ArrowDown, ArrowUp, Lock,
  SlidersHorizontal, Filter, Edit2, Save, Camera, ArrowUpDown,
  ScanLine, QrCode, Send
} from 'lucide-react';

// Initialize Supabase Client
const supabase = createClient(
  'https://riltljeipcaplvwtejaj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpbHRsamVpcGNhcGx2d3RlamFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2MTAzMzcsImV4cCI6MjA4MDE4NjMzN30.StgCRcE7brtSvTARLsfmWHXNQvPcyRl8WiPUNuY9v0Y'
);

// Types
interface Transaction {
  id: string;
  created_at: string;
  title: string;
  amount: number;
  description: string;
  status: string;
  vendor_id?: string;
  farmer_id?: string;
  vendor_email?: string;
  farmer_email?: string;
  delivery_pin?: string;
  category?: string;
  quantity?: number;
  location?: string;
  offer_made_at?: string;
  contract_formed_at?: string;
  funds_deposited_at?: string;
  shipped_at?: string;
  delivered_at?: string;
  completed_at?: string;
  disputed_at?: string;
}

interface WalletTransaction {
  id: string;
  created_at: string;
  amount: number;
  type: 'deposit' | 'withdrawal' | 'escrow_lock' | 'escrow_release' | 'payment_in';
  description: string;
  reference_id?: string;
}

interface Profile {
  id: string;
  display_name: string;
  phone: string;
  location: string;
  bio: string;
  updated_at?: string;
}

interface Message {
  id: string;
  created_at: string;
  content: string;
  sender_id: string;
  sender_email?: string;
  transaction_id: string;
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

-- 2. Create Profiles Table
create table if not exists public.profiles (
  id uuid references auth.users(id) primary key,
  display_name text,
  phone text,
  location text,
  bio text,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 3. Create Wallet Transactions Table (History)
create table if not exists public.wallet_transactions (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid references auth.users(id) not null,
  amount numeric not null,
  type text not null,
  reference_id uuid,
  description text
);

-- 4. Create Escrow Transactions Table
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
  category text default 'Other',
  quantity numeric default 0,
  location text,
  offer_made_at timestamp with time zone,
  contract_formed_at timestamp with time zone,
  funds_deposited_at timestamp with time zone,
  shipped_at timestamp with time zone,
  delivered_at timestamp with time zone,
  completed_at timestamp with time zone,
  disputed_at timestamp with time zone
);

-- 5. Create Messages Table
create table if not exists public.messages (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  transaction_id uuid references public.escrow_transactions(id) not null,
  sender_id uuid references auth.users(id) not null,
  content text not null,
  sender_email text
);

-- 6. RLS Policies
alter table public.wallets enable row level security;
alter table public.profiles enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.escrow_transactions enable row level security;
alter table public.messages enable row level security;

-- Clear existing policies
drop policy if exists "Access own wallet" on public.wallets;
drop policy if exists "Public profiles" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Access own wallet history" on public.wallet_transactions;
drop policy if exists "View transactions" on public.escrow_transactions;
drop policy if exists "Insert transactions" on public.escrow_transactions;
drop policy if exists "Update transactions" on public.escrow_transactions;
drop policy if exists "Access messages" on public.messages;
drop policy if exists "View messages" on public.messages;
drop policy if exists "Insert messages" on public.messages;

-- Wallets
create policy "Access own wallet" on public.wallets for all using (auth.uid() = user_id);

-- Profiles
create policy "Public profiles" on public.profiles for select using (true);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- Wallet Transactions
create policy "Access own wallet history" on public.wallet_transactions for all using (auth.uid() = user_id);

-- Escrow Transactions
create policy "View transactions" on public.escrow_transactions for select
using (vendor_id = auth.uid() or farmer_id = auth.uid() or status = 'listed');

create policy "Insert transactions" on public.escrow_transactions for insert
with check ((vendor_id = auth.uid()) or (farmer_id = auth.uid()));

create policy "Update transactions" on public.escrow_transactions for update
using (
  vendor_id = auth.uid() or farmer_id = auth.uid() or 
  (status = 'listed' and vendor_id is null) or 
  (status = 'listed' and farmer_id is null)
);

-- Messages
create policy "View messages" on public.messages for select using (
  exists (select 1 from public.escrow_transactions t where t.id = transaction_id and (t.vendor_id = auth.uid() or t.farmer_id = auth.uid()))
);

create policy "Insert messages" on public.messages for insert with check (
  auth.uid() = sender_id
);
`;

  const copySql = () => {
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto mt-10">
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xl">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-4">
          <ShieldCheck className="w-6 h-6 text-emerald-600" />
          Database Update Required
        </h2>
        <p className="text-slate-600 mb-4 text-sm">
          To enable user profiles and advanced filtering, please run this updated SQL in your Supabase SQL Editor.
        </p>
        <div className="relative">
          <pre className="bg-slate-900 text-slate-50 p-4 rounded-lg text-xs overflow-auto h-64 font-mono">{sql}</pre>
          <button 
            onClick={copySql}
            className="absolute top-2 right-2 bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded text-xs font-bold transition"
          >
            {copied ? "Copied!" : "Copy SQL"}
          </button>
        </div>
        <button onClick={() => window.location.reload()} className="mt-4 w-full bg-emerald-600 text-white py-3 rounded-lg font-bold">
          I have run the SQL - Reload App
        </button>
      </div>
    </div>
  );
};

// Status Badge Component
const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    listed: "bg-slate-100 text-slate-600 border-slate-200",
    offer_made: "bg-purple-100 text-purple-700 border-purple-200",
    pending_deposit: "bg-amber-100 text-amber-700 border-amber-200",
    in_escrow: "bg-blue-100 text-blue-700 border-blue-200",
    shipped: "bg-indigo-100 text-indigo-700 border-indigo-200",
    delivered: "bg-teal-100 text-teal-700 border-teal-200",
    completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
    disputed: "bg-red-100 text-red-700 border-red-200"
  };
  const labels: Record<string, string> = {
    listed: "Market Listed",
    offer_made: "Offer Pending",
    pending_deposit: "Awaiting Deposit",
    in_escrow: "In Escrow",
    shipped: "In Transit",
    delivered: "Delivered",
    completed: "Completed",
    disputed: "Disputed"
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border shadow-sm ${styles[status] || styles.listed}`}>
      {labels[status] || status}
    </span>
  );
};

// Auth Screen Component
const AuthScreen = ({ onLogin }: { onLogin: () => void }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("vendor");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { role } }
        });
        if (error) throw error;
        if (data.user && !data.session) {
          setError("Check email for verification link.");
          setLoading(false);
          return;
        }
      }
      onLogin();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-slate-100 flex items-center justify-center p-6">
      <div className="bg-white w-full max-w-md p-8 rounded-3xl shadow-2xl shadow-emerald-900/10 border border-white/50 backdrop-blur-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-100 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-50"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-100 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 opacity-50"></div>

        <div className="relative z-10">
          <div className="flex justify-center mb-6">
            <div className="bg-emerald-600 p-4 rounded-2xl shadow-lg shadow-emerald-600/30">
              <Leaf className="w-8 h-8 text-white" />
            </div>
          </div>
          
          <h1 className="text-3xl font-extrabold text-slate-800 text-center mb-2 tracking-tight">Mkulima Express</h1>
          <p className="text-slate-500 text-center mb-8 text-sm font-medium">Secure Escrow for Modern Agriculture</p>
          
          {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4 border border-red-100 flex items-center gap-2"><AlertCircle className="w-4 h-4"/>{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase ml-1">Email</label>
              <input type="email" required className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition font-medium text-slate-800" value={email} onChange={e => setEmail(e.target.value)} placeholder="hello@example.com" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase ml-1">Password</label>
              <input type="password" required className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition font-medium text-slate-800" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
            </div>

            {!isLogin && (
              <div className="grid grid-cols-2 gap-4 mt-2">
                <button type="button" onClick={() => setRole('vendor')} className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all duration-200 ${role === 'vendor' ? 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-md scale-[1.02]' : 'border-slate-100 bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>
                  <Store className="w-6 h-6" /> <span className="font-bold text-sm">Vendor</span>
                </button>
                <button type="button" onClick={() => setRole('farmer')} className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all duration-200 ${role === 'farmer' ? 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-md scale-[1.02]' : 'border-slate-100 bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>
                  <Leaf className="w-6 h-6" /> <span className="font-bold text-sm">Farmer</span>
                </button>
              </div>
            )}

            <button disabled={loading} className="w-full bg-emerald-700 hover:bg-emerald-800 text-white py-4 rounded-xl font-bold text-lg shadow-xl shadow-emerald-700/20 transition-all active:scale-[0.98] flex justify-center items-center mt-6">
              {loading ? <Loader2 className="animate-spin" /> : (isLogin ? "Sign In" : "Create Account")}
            </button>
          </form>
          
          <p className="text-center mt-8 text-slate-500 text-sm">
            <button onClick={() => setIsLogin(!isLogin)} className="text-emerald-700 font-bold hover:underline">
              {isLogin ? "New here? Create Account" : "Already have an account? Log In"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

// Formatter
const formatDate = (dateStr?: string) => {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
};

// Timeline Step Component
interface TimelineStepProps {
  title: string;
  date?: string;
  status: 'done' | 'current' | 'pending';
  isLast?: boolean;
}

const TimelineStep: React.FC<TimelineStepProps> = ({ title, date, status, isLast }) => (
  <div className="flex gap-4 group">
    <div className="flex flex-col items-center">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 border-2 transition-all duration-300 ${
        status === 'done' ? 'bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-600/20' :
        status === 'current' ? 'bg-white border-emerald-600 text-emerald-600 ring-4 ring-emerald-100 scale-110' :
        'bg-slate-50 border-slate-200 text-slate-300'
      }`}>
        {status === 'done' ? <CheckCircle className="w-5 h-5" /> : status === 'current' ? <div className="w-3 h-3 bg-emerald-600 rounded-full animate-pulse" /> : <div className="w-2 h-2 bg-slate-300 rounded-full" />}
      </div>
      {!isLast && <div className={`w-0.5 flex-1 my-1 transition-colors duration-300 ${status === 'done' ? 'bg-emerald-500' : 'bg-slate-100'}`} />}
    </div>
    <div className={`pb-8 pt-1.5 ${status === 'pending' ? 'opacity-40 blur-[0.5px] transition-all group-hover:blur-0 group-hover:opacity-70' : 'opacity-100'}`}>
      <h4 className={`font-bold text-sm ${status === 'current' ? 'text-emerald-800' : 'text-slate-700'}`}>{title}</h4>
      {date && (
        <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500 font-medium">
          <Clock className="w-3 h-3" />
          {formatDate(date)}
        </div>
      )}
    </div>
  </div>
);

// Profile View Component
const ProfileView = ({ profile, userRole, email, onUpdateProfile }: { 
  profile: Profile | null, 
  userRole: string,
  email?: string,
  onUpdateProfile: (p: Partial<Profile>) => Promise<void> 
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<Profile>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setFormData(profile);
    }
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onUpdateProfile(formData);
      setIsEditing(false);
    } catch (err) {
      alert("Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-emerald-600 to-teal-500"></div>
        <div className="relative pt-8">
          <div className="w-24 h-24 bg-white rounded-full p-1.5 mx-auto shadow-lg mb-4">
            <div className="w-full h-full bg-slate-100 rounded-full flex items-center justify-center overflow-hidden relative group">
              <User className="w-10 h-10 text-slate-400" />
              {isEditing && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer">
                  <Camera className="w-6 h-6 text-white" />
                </div>
              )}
            </div>
          </div>
          <h2 className="text-xl font-bold text-slate-800">{profile?.display_name || "Anonymous User"}</h2>
          <p className="text-sm text-slate-500 font-medium">{email}</p>
          <div className="flex justify-center gap-2 mt-3">
            <span className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border border-emerald-200">
              {userRole}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-slate-800 text-lg">Personal Information</h3>
          {!isEditing ? (
            <button onClick={() => setIsEditing(true)} className="text-emerald-600 hover:bg-emerald-50 p-2 rounded-full transition">
              <Edit2 className="w-5 h-5" />
            </button>
          ) : (
            <button onClick={() => setIsEditing(false)} className="text-slate-400 hover:bg-slate-50 p-2 rounded-full transition">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {isEditing ? (
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Display Name</label>
              <input 
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                value={formData.display_name || ''}
                onChange={e => setFormData({...formData, display_name: e.target.value})}
                placeholder="Your Name"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Phone Number</label>
              <input 
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                value={formData.phone || ''}
                onChange={e => setFormData({...formData, phone: e.target.value})}
                placeholder="+254..."
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Location</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  className="w-full p-3 pl-10 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={formData.location || ''}
                  onChange={e => setFormData({...formData, location: e.target.value})}
                  placeholder="City, County"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Bio</label>
              <textarea 
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none h-24 resize-none"
                value={formData.bio || ''}
                onChange={e => setFormData({...formData, bio: e.target.value})}
                placeholder="Tell us about your farm or business..."
              />
            </div>
            <button 
              disabled={saving}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold shadow-lg shadow-emerald-600/20 active:scale-[0.98] transition flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="animate-spin w-5 h-5" /> : <><Save className="w-5 h-5" /> Save Changes</>}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 transition">
              <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                <User className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase">Display Name</p>
                <p className="font-medium text-slate-800">{profile?.display_name || "Not set"}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 transition">
              <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                <User className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase">Phone</p>
                <p className="font-medium text-slate-800">{profile?.phone || "Not set"}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 transition">
              <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase">Location</p>
                <p className="font-medium text-slate-800">{profile?.location || "Not set"}</p>
              </div>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 mt-2">
              <p className="text-xs font-bold text-slate-400 uppercase mb-2">Bio</p>
              <p className="text-sm text-slate-600 italic leading-relaxed">
                {profile?.bio || "No bio added yet."}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Transaction Details Component
const TransactionDetails = ({ 
  transaction: t, 
  role, 
  userId,
  userEmail,
  onClose, 
  onUpdate 
}: { 
  transaction: Transaction, 
  role: string, 
  userId: string, 
  userEmail?: string,
  onClose: () => void,
  onUpdate: (txId: string, status: string, field: string) => void
}) => {
  const isBuyer = t.vendor_id === userId;
  const isSeller = t.farmer_id === userId;
  const [updating, setUpdating] = useState(false);
  const [activeTab, setActiveTab] = useState('status'); // status, chat, logistics

  // Chat State
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Logistics State
  const [deliveryPinInput, setDeliveryPinInput] = useState('');
  const [showScannerMock, setShowScannerMock] = useState(false);

  useEffect(() => {
    // Scroll to bottom of chat
    if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, activeTab]);

  useEffect(() => {
    // Fetch Messages
    const fetchMessages = async () => {
        const { data } = await supabase.from('messages').select('*').eq('transaction_id', t.id).order('created_at', { ascending: true });
        if (data) setMessages(data);
    };
    fetchMessages();

    // Subscribe to new messages
    const channel = supabase.channel(`tx_chat_${t.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `transaction_id=eq.${t.id}` }, (payload) => {
            const newMsg = payload.new as Message;
            // Add message only if we don't have it (prevent duplicate from optimistic update)
            setMessages(prev => {
                if (prev.some(m => m.id === newMsg.id)) return prev;
                return [...prev, newMsg];
            });
        })
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    }
  }, [t.id]);
  
  const handleAction = async (newStatus: string, timestampField: string) => {
    setUpdating(true);
    await onUpdate(t.id, newStatus, timestampField);
    setUpdating(false);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const content = newMessage.trim();
    if (!content) return;
    
    // 1. Optimistic Update (Immediate Feedback)
    const tempId = Math.random().toString();
    const optimisticMsg: Message = {
        id: tempId,
        created_at: new Date().toISOString(),
        content: content,
        sender_id: userId,
        sender_email: userEmail,
        transaction_id: t.id
    };
    setMessages(prev => [...prev, optimisticMsg]);
    setNewMessage('');
    
    try {
        // 2. Network Request
        const { data, error } = await supabase.from('messages').insert({
            transaction_id: t.id,
            sender_id: userId,
            sender_email: userEmail,
            content: content
        }).select().single();

        if (error) throw error;

        // 3. Replace Optimistic Message with Real One
        if (data) {
            setMessages(prev => prev.map(m => m.id === tempId ? data : m));
        }
    } catch (err) {
        alert('Failed to send message');
        // Revert optimistic update
        setMessages(prev => prev.filter(m => m.id !== tempId));
        setNewMessage(content);
    }
  };

  const verifyDelivery = async () => {
    if (deliveryPinInput === t.delivery_pin) {
        await handleAction('delivered', 'delivered_at');
    } else {
        alert("Incorrect PIN. Delivery verification failed.");
    }
  };

  const steps = [
    { title: "Listed on Market", date: t.created_at, status: 'done' },
    { title: "Offer Made", date: t.offer_made_at, status: t.offer_made_at ? 'done' : t.status === 'listed' ? 'pending' : 'done' },
    { title: "Contract Formed", date: t.contract_formed_at, status: t.contract_formed_at ? 'done' : t.status === 'offer_made' ? 'current' : t.status === 'listed' ? 'pending' : 'done' },
    { title: "Funds Secured in Escrow", date: t.funds_deposited_at, status: t.funds_deposited_at ? 'done' : t.status === 'pending_deposit' ? 'current' : ['listed', 'offer_made'].includes(t.status) ? 'pending' : 'done' },
    { title: "Goods Shipped", date: t.shipped_at, status: t.shipped_at ? 'done' : t.status === 'in_escrow' ? 'current' : ['listed', 'offer_made', 'pending_deposit'].includes(t.status) ? 'pending' : 'done' },
    { title: "Delivered", date: t.delivered_at, status: t.delivered_at ? 'done' : t.status === 'shipped' ? 'current' : ['listed', 'offer_made', 'pending_deposit', 'in_escrow'].includes(t.status) ? 'pending' : 'done' },
    { title: "Funds Released (Complete)", date: t.completed_at, status: t.completed_at ? 'done' : t.status === 'delivered' ? 'current' : 'pending' }
  ];

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-md max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 animate-in slide-in-from-bottom-10 duration-300">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-20">
          <div>
            <h2 className="font-extrabold text-xl text-slate-800 leading-tight line-clamp-1">{t.title}</h2>
            <div className="flex items-center gap-2 mt-1.5">
              <StatusBadge status={t.status} />
              <span className="text-xs text-slate-400 font-mono tracking-wide">#{t.id.slice(0,6)}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-50 hover:bg-slate-100 rounded-full transition text-slate-500 hover:text-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dispute Banner */}
        {t.status === 'disputed' && (
          <div className="bg-red-50 px-5 py-3 border-b border-red-100 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-red-700">Transaction Disputed</h3>
              <p className="text-xs text-red-600/80 mt-0.5">Funds are frozen. Please use the chat to resolve the issue with the other party or request admin help.</p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-slate-100">
          <button 
            onClick={() => setActiveTab('status')}
            className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'status' ? 'border-emerald-600 text-emerald-800 bg-emerald-50/50' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
            Details
          </button>
          <button 
            onClick={() => setActiveTab('chat')}
            className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'chat' ? 'border-emerald-600 text-emerald-800 bg-emerald-50/50' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
            Chat & Support
          </button>
          <button 
            onClick={() => setActiveTab('logistics')}
            className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'logistics' ? 'border-emerald-600 text-emerald-800 bg-emerald-50/50' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
            Logistics
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-0 scroll-smooth bg-slate-50">
          {activeTab === 'status' && (
            <>
              {/* Info Card */}
              <div className="p-5 bg-slate-50/50 border-b border-slate-100 space-y-4">
                <div className="flex gap-3">
                  <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1"><CreditCard className="w-3 h-3"/> Amount</span>
                    <div className="text-2xl font-mono font-bold text-emerald-700 tracking-tight">KES {t.amount.toLocaleString()}</div>
                  </div>
                  <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1"><Scale className="w-3 h-3"/> Quantity</span>
                    <div className="text-2xl font-bold text-slate-700 tracking-tight">{t.quantity} <span className="text-sm font-normal text-slate-400">kg</span></div>
                  </div>
                </div>
                {t.location && (
                  <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
                    <div className="p-2 bg-slate-100 rounded-full text-slate-500">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Location</span>
                      <p className="font-bold text-slate-700">{t.location}</p>
                    </div>
                  </div>
                )}
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Description</span>
                  <p className="text-sm text-slate-600 leading-relaxed">{t.description || "No specific details provided."}</p>
                </div>
              </div>

              {/* Timeline */}
              <div className="p-6">
                <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2 text-sm uppercase tracking-wider">
                  <TrendingUp className="w-4 h-4 text-emerald-600" /> Transaction Timeline
                </h3>
                <div className="pl-2">
                  {steps.map((step, idx) => (
                    <TimelineStep 
                      key={idx} 
                      title={step.title}
                      date={step.date}
                      isLast={idx === steps.length - 1} 
                      status={step.status as any} 
                    />
                  ))}
                </div>
              </div>
            </>
          )}

          {activeTab === 'chat' && (
            <div className="flex flex-col h-full bg-slate-50">
              <div className="flex-1 p-4 space-y-3 overflow-y-auto" ref={chatContainerRef}>
                <div className="text-center py-6">
                  <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <p className="text-slate-500 text-sm font-bold">Secure Chat</p>
                  <p className="text-slate-400 text-xs">Direct messages between Farmer & Vendor.</p>
                </div>
                
                {messages.length === 0 && (
                    <div className="text-center text-slate-400 text-xs py-4">No messages yet. Say hello!</div>
                )}

                {messages.map(msg => {
                    const isMe = msg.sender_id === userId;
                    return (
                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] p-3 rounded-2xl text-sm shadow-sm ${isMe ? 'bg-emerald-600 text-white rounded-tr-none' : 'bg-white text-slate-700 rounded-tl-none border border-slate-200'}`}>
                                <p>{msg.content}</p>
                                <p className={`text-[10px] mt-1 ${isMe ? 'text-emerald-200' : 'text-slate-400'}`}>
                                    {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </p>
                            </div>
                        </div>
                    )
                })}
              </div>
              <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-slate-200 sticky bottom-0">
                <div className="flex gap-2">
                  <input 
                    className="flex-1 bg-slate-100 border-transparent focus:bg-white focus:border-emerald-500 focus:ring-0 rounded-xl px-4 py-3 text-sm transition"
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                  />
                  <button type="submit" disabled={!newMessage.trim()} className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white p-3 rounded-xl transition shadow-lg shadow-emerald-600/20">
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'logistics' && (
            <div className="p-6 space-y-6">
                {(isSeller || isBuyer) ? (
                    <>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 text-center">
                            <h3 className="font-bold text-slate-800 mb-2">Delivery Verification</h3>
                            <p className="text-slate-500 text-xs mb-6">Use the secure PIN to verify delivery upon arrival.</p>
                            
                            {isSeller && (
                                <div className="flex flex-col items-center">
                                    {(t.status === 'shipped' || t.status === 'delivered') ? (
                                        <>
                                            <div className="bg-white p-4 rounded-xl border-2 border-slate-900 mb-4 shadow-xl">
                                                {t.delivery_pin ? <QRCode value={t.delivery_pin} size={150} /> : <div className="w-[150px] h-[150px] bg-slate-100 flex items-center justify-center text-xs text-slate-400">Error</div>}
                                            </div>
                                            <div className="bg-emerald-50 text-emerald-800 px-4 py-2 rounded-lg font-mono text-xl font-bold tracking-widest border border-emerald-100">
                                                {t.delivery_pin}
                                            </div>
                                            <p className="text-xs text-slate-500 mt-4 max-w-xs mx-auto">
                                                Allow the Vendor to scan this code or provide them the PIN upon delivery to release funds.
                                            </p>
                                        </>
                                    ) : (
                                        <div className="p-8 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 w-full">
                                            <QrCode className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                                            <p className="text-sm text-slate-400">QR Code will appear when goods are Shipped.</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {isBuyer && (
                                <div>
                                    {(t.status === 'shipped') ? (
                                        <>
                                            {showScannerMock ? (
                                                <div className="relative aspect-square bg-black rounded-xl overflow-hidden mb-4 group cursor-pointer" onClick={() => setShowScannerMock(false)}>
                                                    <div className="absolute inset-0 flex items-center justify-center">
                                                        <div className="w-48 h-48 border-2 border-emerald-500 rounded-lg animate-pulse"></div>
                                                    </div>
                                                    <p className="absolute bottom-4 left-0 right-0 text-white text-xs font-bold">Simulating Camera...</p>
                                                    <X className="absolute top-2 right-2 text-white w-6 h-6" />
                                                </div>
                                            ) : (
                                                <button onClick={() => setShowScannerMock(true)} className="w-full py-8 mb-6 border-2 border-dashed border-emerald-200 bg-emerald-50/50 rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-emerald-50 transition">
                                                    <ScanLine className="w-8 h-8 text-emerald-600" />
                                                    <span className="text-sm font-bold text-emerald-700">Scan Seller's QR Code</span>
                                                </button>
                                            )}
                                            
                                            <div className="relative">
                                                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
                                                <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-slate-400 font-bold">Or Enter PIN</span></div>
                                            </div>

                                            <div className="mt-4 flex gap-2">
                                                <input 
                                                    className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-center font-mono text-lg tracking-widest uppercase outline-none focus:ring-2 focus:ring-emerald-500"
                                                    placeholder="PIN"
                                                    maxLength={7}
                                                    value={deliveryPinInput}
                                                    onChange={e => setDeliveryPinInput(e.target.value)}
                                                />
                                                <button 
                                                    onClick={verifyDelivery}
                                                    className="bg-slate-900 text-white px-6 rounded-xl font-bold hover:bg-slate-800 transition"
                                                >
                                                    Verify
                                                </button>
                                            </div>
                                        </>
                                    ) : t.status === 'delivered' || t.status === 'completed' ? (
                                        <div className="py-8">
                                            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                                <CheckCircle className="w-8 h-8 text-emerald-600" />
                                            </div>
                                            <h4 className="font-bold text-emerald-800">Delivery Verified!</h4>
                                            <p className="text-xs text-emerald-600 mt-1">Transaction is secured.</p>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-slate-400 italic">Waiting for shipment...</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="text-center py-10">
                        <Lock className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                        <p className="text-slate-400 text-sm font-medium">Logistics information is only available to the Buyer and Seller.</p>
                    </div>
                )}
            </div>
          )}
        </div>

        {/* Actions Footer */}
        {activeTab === 'status' && (
          <div className="p-4 border-t border-slate-100 bg-white sticky bottom-0 z-20 pb-6">
            {isSeller && t.status === 'offer_made' && (
              <button 
                onClick={() => handleAction('pending_deposit', 'contract_formed_at')}
                disabled={updating}
                className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold hover:bg-emerald-700 transition flex justify-center items-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-[0.98]"
              >
                {updating ? <Loader2 className="animate-spin" /> : "Accept Offer & Form Contract"}
              </button>
            )}
            
            {isBuyer && t.status === 'pending_deposit' && (
              <button 
                onClick={() => handleAction('in_escrow', 'funds_deposited_at')}
                disabled={updating}
                className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold hover:bg-emerald-700 transition flex justify-center items-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-[0.98]"
              >
                {updating ? <Loader2 className="animate-spin" /> : <><CreditCard className="w-5 h-5" /> Deposit Funds to Escrow</>}
              </button>
            )}

            {isSeller && t.status === 'in_escrow' && (
              <button 
                onClick={() => handleAction('shipped', 'shipped_at')}
                disabled={updating}
                className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold hover:bg-indigo-700 transition flex justify-center items-center gap-2 shadow-lg shadow-indigo-600/20 active:scale-[0.98]"
              >
                {updating ? <Loader2 className="animate-spin" /> : <><Truck className="w-5 h-5" /> Mark as Shipped</>}
              </button>
            )}

            {isBuyer && t.status === 'shipped' && (
              <button 
                onClick={() => setActiveTab('logistics')}
                className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold hover:bg-emerald-700 transition flex justify-center items-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-[0.98]"
              >
                <ScanLine className="w-5 h-5" /> Confirm Delivery via QR
              </button>
            )}

            {isBuyer && t.status === 'delivered' && (
              <button 
                onClick={() => handleAction('completed', 'completed_at')}
                disabled={updating}
                className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold hover:bg-emerald-700 transition flex justify-center items-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-[0.98]"
              >
                {updating ? <Loader2 className="animate-spin" /> : <><CheckCircle className="w-5 h-5" /> Release Funds to Farmer</>}
              </button>
            )}

            {['pending_deposit', 'in_escrow', 'shipped', 'delivered'].includes(t.status) && !t.disputed_at && (
              <button 
                onClick={() => handleAction('disputed', 'disputed_at')}
                disabled={updating}
                className="mt-3 w-full bg-white text-red-500 border border-red-200 py-3 rounded-xl font-bold hover:bg-red-50 transition flex justify-center items-center gap-2 active:scale-[0.98]"
              >
                <AlertCircle className="w-5 h-5" /> Raise Dispute
              </button>
            )}

            {t.status === 'disputed' && (
                <div className="grid grid-cols-2 gap-3 mt-3">
                    <button className="bg-slate-800 text-white py-3 rounded-xl font-bold text-xs">Request Admin</button>
                    <button 
                        onClick={() => handleAction(t.shipped_at ? 'shipped' : 'in_escrow', 'disputed_at')} 
                        className="bg-emerald-100 text-emerald-700 py-3 rounded-xl font-bold text-xs"
                    >
                        Resolve Dispute
                    </button>
                </div>
            )}
            
            {t.status === 'completed' && (
              <div className="bg-emerald-50 text-emerald-800 text-center py-3 rounded-xl font-bold text-sm border border-emerald-100 flex items-center justify-center gap-2">
                <CheckCircle className="w-5 h-5" /> Transaction Completed
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Wallet View Component
const WalletView = ({ wallet, transactions, onTopUp, onWithdraw }: { 
  wallet: any, 
  transactions: WalletTransaction[],
  onTopUp: (amount: number) => Promise<void>,
  onWithdraw: (amount: number, phone: string) => Promise<void>
}) => {
  const [activeAction, setActiveAction] = useState<'none' | 'topup' | 'withdraw'>('none');
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (activeAction === 'topup') await onTopUp(Number(amount));
      if (activeAction === 'withdraw') await onWithdraw(Number(amount), phone);
      setActiveAction('none');
      setAmount('');
      setPhone('');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Balance Card */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-6 text-white shadow-xl shadow-slate-900/20 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-2 text-slate-300 text-xs font-bold uppercase tracking-wider">
              <Wallet className="w-4 h-4" /> Total Balance
            </div>
            <div className="px-2 py-1 bg-white/10 rounded-lg text-[10px] font-bold text-white/80 backdrop-blur-sm border border-white/10">Active</div>
          </div>
          <div className="text-4xl font-mono font-bold tracking-tighter text-white mb-6">KES {wallet?.balance.toLocaleString() ?? '...'}</div>
          <div className="flex gap-3">
            <button onClick={() => setActiveAction('topup')} className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-3 rounded-xl text-sm font-bold shadow-lg shadow-emerald-900/20 transition active:scale-[0.98] flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" /> Top Up
            </button>
            <button onClick={() => setActiveAction('withdraw')} className="flex-1 bg-white/10 border border-white/20 text-white px-4 py-3 rounded-xl text-sm font-bold backdrop-blur-md hover:bg-white/20 transition active:scale-[0.98] flex items-center justify-center gap-2">
              <ArrowUpRight className="w-4 h-4" /> Withdraw
            </button>
          </div>
        </div>
      </div>

      {/* Action Forms */}
      {activeAction !== 'none' && (
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 animate-in slide-in-from-top-2">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-slate-800">{activeAction === 'topup' ? 'Top Up Wallet' : 'Withdraw Funds'}</h3>
            <button onClick={() => setActiveAction('none')} className="p-1 hover:bg-slate-100 rounded-full"><X className="w-4 h-4 text-slate-400" /></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase ml-1">Amount (KES)</label>
              <input type="number" required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-mono font-medium" value={amount} onChange={e => setAmount(e.target.value)} placeholder="1000" />
            </div>
            {activeAction === 'withdraw' && (
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">M-Pesa Number</label>
                <input type="tel" required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium" value={phone} onChange={e => setPhone(e.target.value)} placeholder="2547XXXXXXXX" />
              </div>
            )}
            <button disabled={loading} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition flex justify-center items-center gap-2">
              {loading ? <Loader2 className="animate-spin w-4 h-4" /> : "Confirm Transaction"}
            </button>
          </form>
        </div>
      )}

      {/* Transactions List */}
      <div>
        <h3 className="font-bold text-slate-800 mb-4 px-1">Transaction History</h3>
        {transactions.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-xl border border-dashed border-slate-200">
            <p className="text-slate-400 text-sm">No transactions yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map(tx => (
              <div key={tx.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  tx.type === 'deposit' || tx.type === 'payment_in' ? 'bg-emerald-100 text-emerald-600' : 
                  tx.type === 'escrow_lock' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'
                }`}>
                  {tx.type === 'deposit' || tx.type === 'payment_in' ? <ArrowDown className="w-5 h-5" /> : 
                   tx.type === 'escrow_lock' ? <Lock className="w-4 h-4" /> : <ArrowUp className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <h4 className="font-bold text-slate-700 text-sm truncate">{tx.description}</h4>
                    <span className={`font-mono font-bold text-sm ${
                      tx.type === 'deposit' || tx.type === 'payment_in' ? 'text-emerald-600' : 'text-slate-800'
                    }`}>
                      {tx.type === 'deposit' || tx.type === 'payment_in' ? '+' : '-'} {Math.abs(tx.amount).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <p className="text-xs text-slate-400 capitalize">{tx.type.replace('_', ' ')}</p>
                    <p className="text-xs text-slate-400">{formatDate(tx.created_at)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Main App Component
const App = () => {
  const [session, setSession] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [wallet, setWallet] = useState<any>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>([]);
  const [dashboardFilter, setDashboardFilter] = useState('all');
  const [activeTransactionId, setActiveTransactionId] = useState<string | null>(null);
  const [role, setRole] = useState("vendor");
  const [showSetup, setShowSetup] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Profile State
  const [profile, setProfile] = useState<Profile | null>(null);

  // Advanced Filter State
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    category: 'All',
    minPrice: '',
    maxPrice: '',
    location: ''
  });
  
  // Create Form State
  const [createForm, setCreateForm] = useState({
    title: '',
    category: 'Maize',
    quantity: '',
    amount: '',
    description: '',
    location: ''
  });
  const [creating, setCreating] = useState(false);
  const [trendSort, setTrendSort] = useState<'price-desc' | 'price-asc' | 'name-asc'>('price-desc');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        setRole(session.user.user_metadata.role || 'vendor');
        fetchData(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        setRole(session.user.user_metadata.role || 'vendor');
        fetchData(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchData = async (userId: string) => {
    // Explicitly select 'location' and 'delivery_pin' too
    const { data: txs, error } = await supabase.from('escrow_transactions').select('*, funds_deposited_at, location, delivery_pin').order('created_at', { ascending: false });
    if (error) {
        if (error.code === '42P01' || error.code === '42703' || error.message.includes('column') || error.message.includes('relation')) {
            setShowSetup(true); // Table or Column missing
        }
    } else {
        setTransactions(txs || []);
    }
    
    // Fetch Profile
    const { data: profileData, error: profileError } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (profileData) {
      setProfile(profileData);
    } else if (profileError && (profileError.code === '42P01' || profileError.message.includes('relation'))) {
       setShowSetup(true);
    } else {
      setProfile({ id: userId, display_name: '', phone: '', location: '', bio: '' });
    }

    const { data: walletData } = await supabase.from('wallets').select('*').eq('user_id', userId).single();
    if (walletData) setWallet(walletData);
    else {
      const { data: newWallet } = await supabase.from('wallets').insert([{ user_id: userId, balance: 0 }]).select().single();
      if (newWallet) setWallet(newWallet);
    }

    const { data: walletTx } = await supabase.from('wallet_transactions').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    setWalletTransactions(walletTx || []);
  };

  const handleUpdateProfile = async (updates: Partial<Profile>) => {
    if (!session?.user) return;
    try {
      const { error } = await supabase.from('profiles').upsert({
        id: session.user.id,
        ...updates,
        updated_at: new Date().toISOString()
      });
      if (error) throw error;
      await fetchData(session.user.id);
    } catch (err: any) {
      throw err;
    }
  };

  // Market Trends Calculation
  const marketTrends = useMemo(() => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const categories = ['Maize', 'Beans', 'Potatoes', 'Tomatoes', 'Onions', 'Rice', 'Bananas'];
    
    let trends = categories.map(cat => {
      const catTxs = transactions.filter(t => 
        t.category === cat && 
        t.amount > 0 && 
        (t.quantity || 0) > 0 &&
        t.status !== 'disputed'
      );

      const calculateAvg = (txs: Transaction[]) => {
        if (!txs.length) return 0;
        const totalQty = txs.reduce((sum, t) => sum + Number(t.quantity), 0);
        const totalAmt = txs.reduce((sum, t) => sum + Number(t.amount), 0);
        return totalQty > 0 ? totalAmt / totalQty : 0;
      };

      const recentTxs = catTxs.filter(t => new Date(t.created_at) >= sevenDaysAgo);
      const prevTxs = catTxs.filter(t => {
        const d = new Date(t.created_at);
        return d >= fourteenDaysAgo && d < sevenDaysAgo;
      });

      const currentAvg = calculateAvg(recentTxs);
      const prevAvg = calculateAvg(prevTxs);

      return {
        name: cat,
        price: currentAvg || prevAvg || 0,
        change: prevAvg > 0 ? ((currentAvg - prevAvg) / prevAvg) * 100 : 0,
        hasData: recentTxs.length > 0 || prevTxs.length > 0,
        isUp: currentAvg >= prevAvg
      };
    }).filter(t => t.hasData);

    return trends.sort((a, b) => {
      if (trendSort === 'name-asc') return a.name.localeCompare(b.name);
      if (trendSort === 'price-asc') return a.price - b.price;
      return b.price - a.price;
    });
  }, [transactions, trendSort]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const isVendor = role === 'vendor';
      const { error } = await supabase.from('escrow_transactions').insert({
        title: createForm.title,
        amount: Number(createForm.amount),
        description: createForm.description,
        category: createForm.category,
        quantity: Number(createForm.quantity),
        location: createForm.location,
        vendor_id: isVendor ? session.user.id : null,
        farmer_id: isVendor ? null : session.user.id,
        vendor_email: isVendor ? session.user.email : null,
        farmer_email: isVendor ? null : session.user.email,
        status: 'listed'
      });

      if (error) throw error;
      setCreateForm({ title: '', category: 'Maize', quantity: '', amount: '', description: '', location: '' });
      setActiveTab('dashboard');
      fetchData(session.user.id);
    } catch (err: any) {
      alert("Error creating listing: " + err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleClaim = async (txId: string) => {
    try {
      const timestamp = new Date().toISOString();
      const updateData = role === 'vendor' 
        ? { vendor_id: session.user.id, vendor_email: session.user.email, status: 'offer_made', offer_made_at: timestamp }
        : { farmer_id: session.user.id, farmer_email: session.user.email, status: 'pending_deposit', contract_formed_at: timestamp };

      const { error } = await supabase.from('escrow_transactions').update(updateData).eq('id', txId);
      if (error) throw error;
      fetchData(session.user.id);
      setActiveTab('dashboard');
      setActiveTransactionId(txId); // Open details immediately
    } catch (err: any) {
      alert("Error claiming listing: " + err.message);
    }
  };

  const handleUpdateStatus = async (txId: string, newStatus: string, timestampField: string) => {
    try {
      const tx = transactions.find(t => t.id === txId);
      if (!tx) throw new Error("Transaction not found");

      // Financial Logic
      if (newStatus === 'in_escrow' && tx.status === 'pending_deposit') {
        if (!wallet || wallet.balance < tx.amount) {
          throw new Error("Insufficient funds. Please top up your wallet.");
        }
        // Deduct from Vendor
        await supabase.from('wallets').update({ balance: wallet.balance - tx.amount }).eq('user_id', session.user.id);
        await supabase.from('wallet_transactions').insert({
          user_id: session.user.id,
          amount: -tx.amount,
          type: 'escrow_lock',
          description: `Escrow Lock for ${tx.title}`,
          reference_id: txId
        });
      }

      if (newStatus === 'completed' && tx.status === 'delivered') {
        // Release to Farmer
        const { data: farmerWallet } = await supabase.from('wallets').select('*').eq('user_id', tx.farmer_id).single();
        if (farmerWallet) {
          await supabase.from('wallets').update({ balance: farmerWallet.balance + tx.amount }).eq('user_id', tx.farmer_id);
          await supabase.from('wallet_transactions').insert({
            user_id: tx.farmer_id,
            amount: tx.amount,
            type: 'payment_in',
            description: `Payment Received for ${tx.title}`,
            reference_id: txId
          });
        }
      }

      const updateData = { 
        status: newStatus,
        [timestampField]: new Date().toISOString()
      };
      const { error } = await supabase.from('escrow_transactions').update(updateData).eq('id', txId);
      if (error) throw error;
      fetchData(session.user.id);
    } catch (err: any) {
      alert("Error updating status: " + err.message);
    }
  };

  const handleTopUp = async (amount: number) => {
    // Simulating M-Pesa
    const newBalance = (wallet?.balance || 0) + amount;
    await supabase.from('wallets').update({ balance: newBalance }).eq('user_id', session.user.id);
    await supabase.from('wallet_transactions').insert({
      user_id: session.user.id,
      amount: amount,
      type: 'deposit',
      description: 'M-Pesa Top Up'
    });
    fetchData(session.user.id);
  };

  const handleWithdraw = async (amount: number, phone: string) => {
    if ((wallet?.balance || 0) < amount) throw new Error("Insufficient balance");
    const newBalance = wallet.balance - amount;
    await supabase.from('wallets').update({ balance: newBalance }).eq('user_id', session.user.id);
    await supabase.from('wallet_transactions').insert({
      user_id: session.user.id,
      amount: -amount,
      type: 'withdrawal',
      description: `Withdrawal to ${phone}`
    });
    fetchData(session.user.id);
  };

  if (!session) return <AuthScreen onLogin={() => {}} />;
  if (showSetup) return <SetupRequired />;

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50/50 shadow-2xl overflow-hidden relative pb-24">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md sticky top-0 z-30 px-5 py-4 border-b border-slate-200/60 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-600 p-2 rounded-xl shadow-md shadow-emerald-600/20"><Leaf className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="font-extrabold text-slate-800 text-lg leading-none tracking-tight">Mkulima Express</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{role}</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="p-2.5 text-slate-400 hover:text-slate-600 transition bg-slate-100/50 rounded-full hover:bg-slate-100">
            <Bell className="w-5 h-5" />
          </button>
          <button onClick={() => supabase.auth.signOut()} className="p-2.5 text-slate-400 hover:text-red-500 transition bg-slate-100/50 rounded-full hover:bg-red-50">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="p-5 space-y-6">
        {/* Dashboard View */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in duration-500">
             {/* Stats Card */}
             <div className="bg-gradient-to-br from-emerald-900 to-emerald-700 rounded-3xl p-6 text-white shadow-xl shadow-emerald-900/20 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500 rounded-full mix-blend-overlay filter blur-3xl opacity-20 -translate-y-1/2 translate-x-1/2 group-hover:opacity-30 transition duration-700"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500 rounded-full mix-blend-overlay filter blur-3xl opacity-20 translate-y-1/2 -translate-x-1/2 group-hover:opacity-30 transition duration-700"></div>
                
                {/* Pattern overlay */}
                <div className="absolute inset-0 opacity-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9IiNmZmYiLz48L3N2Zz4=')]"></div>

                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2 text-emerald-200 text-xs font-bold uppercase tracking-wider">
                      <Wallet className="w-4 h-4" /> Wallet Balance
                    </div>
                    <div className="px-2 py-1 bg-white/10 rounded-lg text-[10px] font-bold text-white/80 backdrop-blur-sm">KES Account</div>
                  </div>
                  <div className="text-4xl font-mono font-bold tracking-tighter text-white mb-6">KES {wallet?.balance.toLocaleString() ?? '...'}</div>
                  <div className="flex gap-3">
                    <button onClick={() => setActiveTab('wallet')} className="flex-1 bg-white text-emerald-900 px-4 py-3 rounded-xl text-sm font-bold shadow-lg shadow-black/10 hover:bg-emerald-50 transition active:scale-[0.98] flex items-center justify-center gap-2">
                      <Plus className="w-4 h-4" /> Top Up
                    </button>
                    <button onClick={() => setActiveTab('wallet')} className="flex-1 bg-emerald-800/50 border border-emerald-500/30 text-white px-4 py-3 rounded-xl text-sm font-bold backdrop-blur-md hover:bg-emerald-800/70 transition active:scale-[0.98]">
                      View
                    </button>
                  </div>
                </div>
             </div>

             {/* Recent Activity */}
             <div>
               <div className="flex justify-between items-end mb-4 px-1">
                 <h2 className="font-bold text-slate-800 text-lg">Your Activity</h2>
                 
                 {/* Filter Chips */}
                 <div className="flex bg-slate-200/50 p-1 rounded-xl">
                    {['all', 'active', 'completed'].map(f => (
                      <button 
                        key={f}
                        onClick={() => setDashboardFilter(f as any)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold capitalize transition-all ${
                          dashboardFilter === f 
                            ? 'bg-white text-slate-800 shadow-sm' 
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                 </div>
               </div>

               {/* Filter Logic & List */}
               {(() => {
                 const myTxs = transactions.filter(t => t.farmer_id === session.user.id || t.vendor_id === session.user.id);
                 const filteredTxs = myTxs.filter(t => {
                    if (dashboardFilter === 'all') return true;
                    if (dashboardFilter === 'completed') return t.status === 'completed';
                    if (dashboardFilter === 'active') return !['completed', 'disputed'].includes(t.status);
                    return true;
                 });

                 if (filteredTxs.length === 0) {
                   return (
                     <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-slate-200">
                       <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                         <Leaf className="w-8 h-8 text-slate-300" />
                       </div>
                       <p className="text-slate-500 text-sm font-medium">No {dashboardFilter === 'all' ? '' : dashboardFilter} transactions found.</p>
                       <button onClick={() => setActiveTab('create')} className="mt-4 px-5 py-2 bg-emerald-50 text-emerald-700 font-bold text-xs rounded-full hover:bg-emerald-100 transition">
                         Start New Transaction
                       </button>
                     </div>
                   );
                 }

                 return (
                   <div className="space-y-3">
                     {filteredTxs.map(t => (
                       <div key={t.id} onClick={() => setActiveTransactionId(t.id)} className="group bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-[0.99] relative overflow-hidden">
                         <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                           t.status === 'completed' ? 'bg-emerald-500' : 
                           t.status === 'disputed' ? 'bg-red-500' :
                           'bg-amber-500'
                         }`}></div>
                         <div className="flex items-center gap-4 pl-2">
                           <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${t.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                             {t.status === 'completed' ? <CheckCircle className="w-6 h-6" /> : <CreditCard className="w-6 h-6" />}
                           </div>
                           <div className="flex-1 min-w-0">
                             <div className="flex justify-between items-start mb-1">
                                <h3 className="font-bold text-slate-800 truncate pr-2 group-hover:text-emerald-700 transition-colors">{t.title}</h3>
                                <span className="text-emerald-700 font-mono font-bold text-sm whitespace-nowrap">KES {t.amount.toLocaleString()}</span>
                             </div>
                             <div className="flex justify-between items-center">
                                <p className="text-xs text-slate-400 truncate max-w-[120px] font-medium">{t.created_at.slice(0, 10)}</p>
                                <StatusBadge status={t.status} />
                             </div>
                           </div>
                           <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-emerald-500 transition-colors" />
                         </div>
                       </div>
                     ))}
                   </div>
                 );
               })()}
             </div>
          </div>
        )}

        {/* Market View */}
        {activeTab === 'market' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            {/* Search Bar & Filter Toggle */}
            <div className="relative sticky top-0 z-10 pt-2 -mt-2 bg-slate-50/50 backdrop-blur-sm pb-2">
               <div className="flex gap-2">
                 <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition font-medium text-slate-700 placeholder:text-slate-400"
                      placeholder="Search produce..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                    />
                 </div>
                 <button 
                   onClick={() => setShowFilters(!showFilters)}
                   className={`p-4 rounded-2xl border transition-all shadow-sm ${showFilters ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-200 text-slate-500 hover:text-emerald-600'}`}
                 >
                   <SlidersHorizontal className="w-6 h-6" />
                 </button>
               </div>

               {/* Advanced Filters Panel */}
               {showFilters && (
                 <div className="mt-2 bg-white p-4 rounded-2xl border border-slate-200 shadow-md animate-in slide-in-from-top-2">
                   <div className="flex justify-between items-center mb-3">
                     <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                       <Filter className="w-4 h-4 text-emerald-600" /> Filters
                     </h3>
                     <button onClick={() => setFilters({category: 'All', minPrice: '', maxPrice: '', location: ''})} className="text-[10px] font-bold text-slate-400 hover:text-red-500">
                       Clear All
                     </button>
                   </div>
                   
                   <div className="space-y-3">
                     {/* Category */}
                     <div>
                       <label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block">Category</label>
                       <select 
                         className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 outline-none focus:border-emerald-500"
                         value={filters.category}
                         onChange={e => setFilters({...filters, category: e.target.value})}
                       >
                         <option value="All">All Categories</option>
                         {['Maize', 'Beans', 'Potatoes', 'Tomatoes', 'Onions', 'Rice', 'Bananas', 'Other'].map(c => (
                           <option key={c} value={c}>{c}</option>
                         ))}
                       </select>
                     </div>

                     {/* Price Range */}
                     <div>
                       <label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block">Price Range (KES)</label>
                       <div className="flex gap-2">
                         <input 
                           type="number" 
                           placeholder="Min" 
                           className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 outline-none focus:border-emerald-500"
                           value={filters.minPrice}
                           onChange={e => setFilters({...filters, minPrice: e.target.value})}
                         />
                         <input 
                           type="number" 
                           placeholder="Max" 
                           className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 outline-none focus:border-emerald-500"
                           value={filters.maxPrice}
                           onChange={e => setFilters({...filters, maxPrice: e.target.value})}
                         />
                       </div>
                     </div>

                     {/* Location */}
                     <div>
                       <label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block">Location</label>
                       <div className="relative">
                         <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                         <input 
                           placeholder="e.g. Nairobi, Nakuru" 
                           className="w-full p-2.5 pl-9 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 outline-none focus:border-emerald-500"
                           value={filters.location}
                           onChange={e => setFilters({...filters, location: e.target.value})}
                         />
                       </div>
                     </div>
                   </div>
                 </div>
               )}
            </div>

            {/* Market Trends Section */}
            {!showFilters && (
              <div>
                <style>{`
                  @keyframes ticker {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                  }
                  .animate-ticker {
                    animation: ticker 40s linear infinite;
                    width: max-content;
                    display: flex;
                  }
                  .animate-ticker:hover {
                    animation-play-state: paused;
                  }
                `}</style>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="bg-slate-900 p-1.5 rounded-lg">
                      <TrendingUp className="w-4 h-4 text-white" />
                    </div>
                    <h2 className="font-bold text-slate-800 text-sm uppercase tracking-wide">Rolling 7-Day Trends</h2>
                  </div>
                  
                  {marketTrends.length > 0 && (
                    <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1 shadow-sm">
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      <select 
                        value={trendSort} 
                        onChange={(e) => setTrendSort(e.target.value as any)}
                        className="text-[10px] font-bold text-slate-600 bg-transparent border-none outline-none cursor-pointer hover:text-emerald-700 transition appearance-none pr-1"
                      >
                        <option value="price-desc">Highest Price</option>
                        <option value="price-asc">Lowest Price</option>
                        <option value="name-asc">Name (A-Z)</option>
                      </select>
                    </div>
                  )}
                </div>
                
                {marketTrends.length > 0 ? (
                  <div className="relative overflow-hidden w-full -mx-5 px-5 py-2">
                    {/* Gradient Masks */}
                    <div className="absolute left-0 top-0 bottom-0 w-12 z-10 bg-gradient-to-r from-slate-50 to-transparent pointer-events-none"></div>
                    <div className="absolute right-0 top-0 bottom-0 w-12 z-10 bg-gradient-to-l from-slate-50 to-transparent pointer-events-none"></div>
                    
                    <div className="flex animate-ticker">
                      {/* Render double the items for seamless looping. Using margin instead of gap for perfect -50% offset calculation. */}
                      {[...marketTrends, ...marketTrends].map((item, idx) => (
                        <div key={`${item.name}-${idx}`} className="mr-4 min-w-[160px] bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col hover:shadow-md transition-shadow relative overflow-hidden group">
                          <div className={`absolute top-0 right-0 w-16 h-16 rounded-bl-full opacity-10 transition-colors ${item.isUp ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                          <span className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">{item.name}</span>
                          <div className="flex items-baseline gap-1 mt-auto">
                            <span className="text-2xl font-extrabold text-slate-800 tracking-tight">KES {item.price.toFixed(0)}</span>
                            <span className="text-[10px] text-slate-400 font-medium">/kg</span>
                          </div>
                          <div className={`mt-2 flex items-center gap-1.5 text-[11px] font-bold ${item.isUp ? 'text-emerald-700 bg-emerald-50 border-emerald-100' : 'text-red-700 bg-red-50 border-red-100'} w-fit px-2.5 py-1 rounded-lg border`}>
                            {item.isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                            {Math.abs(item.change).toFixed(1)}%
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="bg-white p-6 rounded-2xl border border-slate-100 text-center shadow-sm">
                    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Scale className="w-6 h-6 text-slate-300" />
                    </div>
                    <p className="text-xs text-slate-500 font-medium">Not enough data to calculate market trends yet.</p>
                  </div>
                )}
              </div>
            )}

            {/* Active Listings */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="bg-slate-900 p-1.5 rounded-lg">
                  <Package className="w-4 h-4 text-white" />
                </div>
                <h2 className="font-bold text-slate-800 text-sm uppercase tracking-wide">
                  {showFilters ? 'Filtered Listings' : 'Recent Listings'}
                </h2>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {(() => {
                  const filteredListings = transactions.filter(t => 
                    t.status === 'listed' && (
                      // Search Query Filter
                      (searchQuery === '' || 
                        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (t.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (t.category || '').toLowerCase().includes(searchQuery.toLowerCase())
                      ) &&
                      // Category Filter
                      (filters.category === 'All' || t.category === filters.category) &&
                      // Price Range Filter
                      (filters.minPrice === '' || t.amount >= Number(filters.minPrice)) &&
                      (filters.maxPrice === '' || t.amount <= Number(filters.maxPrice)) &&
                      // Location Filter
                      (filters.location === '' || (t.location || '').toLowerCase().includes(filters.location.toLowerCase()))
                    )
                  );

                  if (filteredListings.length === 0) {
                    return (
                      <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-slate-200">
                        <p className="text-slate-500 text-sm font-medium">No listings found matching your criteria.</p>
                        {(filters.category !== 'All' || filters.minPrice || filters.maxPrice || filters.location) && (
                          <button 
                            onClick={() => setFilters({category: 'All', minPrice: '', maxPrice: '', location: ''})}
                            className="mt-2 text-emerald-600 font-bold text-xs hover:underline"
                          >
                            Clear Filters
                          </button>
                        )}
                      </div>
                    );
                  }

                  return filteredListings.map(t => (
                    <div key={t.id} onClick={() => handleClaim(t.id)} className="bg-white p-0 rounded-2xl border border-slate-100 shadow-sm hover:border-emerald-500 transition-all group overflow-hidden cursor-pointer relative">
                      <div className="p-5 flex justify-between items-start">
                        <div className="flex-1 min-w-0 pr-4">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider">
                              {t.category || 'Produce'}
                            </span>
                            {t.quantity && t.quantity > 0 && (
                              <span className="flex items-center gap-1 text-[10px] text-slate-500 font-bold bg-slate-50 px-2 py-1 rounded-md">
                                <Scale className="w-3 h-3" /> {t.quantity}kg
                              </span>
                            )}
                            {t.location && (
                              <span className="flex items-center gap-1 text-[10px] text-slate-500 font-bold bg-slate-50 px-2 py-1 rounded-md">
                                <MapPin className="w-3 h-3" /> {t.location}
                              </span>
                            )}
                          </div>
                          <h3 className="font-bold text-slate-800 text-lg leading-tight mb-1">{t.title}</h3>
                          <p className="text-xs text-slate-500 line-clamp-1">{t.description || "No description"}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-mono font-bold text-emerald-700 text-xl tracking-tight">KES {t.amount.toLocaleString()}</div>
                          <div className="text-[10px] text-slate-400 mt-1 font-medium text-right">
                            {t.quantity ? `~ ${(t.amount/t.quantity).toFixed(0)}/kg` : 'Flat Rate'}
                          </div>
                        </div>
                      </div>
                      
                      {/* Footer Action Strip */}
                      <div className={`px-5 py-3 flex justify-between items-center ${
                        (role === 'vendor' && t.farmer_id) ? 'bg-emerald-50' :
                        (role === 'farmer' && t.vendor_id) ? 'bg-amber-50' :
                        'bg-slate-50'
                      }`}>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${t.farmer_id ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            {t.farmer_id ? 'Farmer Selling' : 'Vendor Buying'}
                          </span>
                        </div>
                        <span className={`text-xs font-bold flex items-center gap-1 transition-colors ${
                           (role === 'vendor' && t.farmer_id) ? 'text-emerald-700 group-hover:translate-x-1' :
                           (role === 'farmer' && t.vendor_id) ? 'text-amber-700 group-hover:translate-x-1' :
                           'text-slate-400'
                        }`}>
                          {(role === 'vendor' && t.farmer_id) ? 'Make Offer' : (role === 'farmer' && t.vendor_id) ? 'Fulfill Request' : 'View Details'} 
                          <ChevronRight className="w-4 h-4" />
                        </span>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Create View */}
        {activeTab === 'create' && (
          <div className="animate-in slide-in-from-bottom-5 duration-300">
            <div className="bg-white p-6 rounded-3xl shadow-lg shadow-slate-200/50 border border-slate-100">
              <h2 className="text-xl font-extrabold text-slate-800 mb-6 flex items-center gap-3 pb-4 border-b border-slate-50">
                <div className="bg-emerald-100 p-2 rounded-xl text-emerald-700">
                  <Plus className="w-6 h-6" />
                </div>
                {role === 'farmer' ? 'List Produce (Sell)' : 'Create Request (Buy)'}
              </h2>
              <form onSubmit={handleCreate} className="space-y-5">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2 ml-1">Category</label>
                  <div className="relative">
                    <select 
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition appearance-none font-medium text-slate-700"
                      value={createForm.category}
                      onChange={e => setCreateForm({...createForm, category: e.target.value})}
                    >
                      {['Maize', 'Beans', 'Potatoes', 'Tomatoes', 'Onions', 'Rice', 'Bananas', 'Other'].map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <ChevronRight className="w-5 h-5 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2 ml-1">Title</label>
                  <input 
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition font-medium placeholder:font-normal"
                    placeholder="e.g., 5 Bags of Yellow Beans"
                    value={createForm.title}
                    onChange={e => setCreateForm({...createForm, title: e.target.value})}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2 ml-1">Quantity (kg)</label>
                    <input 
                      type="number"
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none font-mono font-medium"
                      placeholder="100"
                      value={createForm.quantity}
                      onChange={e => setCreateForm({...createForm, quantity: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2 ml-1">Total Amount (KES)</label>
                    <input 
                      type="number"
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none font-mono font-medium"
                      placeholder="5000"
                      value={createForm.amount}
                      onChange={e => setCreateForm({...createForm, amount: e.target.value})}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2 ml-1">Location</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input 
                      className="w-full p-4 pl-12 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition font-medium placeholder:font-normal"
                      placeholder="e.g. Nairobi, Nakuru, Eldoret"
                      value={createForm.location}
                      onChange={e => setCreateForm({...createForm, location: e.target.value})}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2 ml-1">Description</label>
                  <textarea 
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none h-32 resize-none transition font-medium placeholder:font-normal"
                    placeholder="Describe quality, packaging, specific pickup details..."
                    value={createForm.description}
                    onChange={e => setCreateForm({...createForm, description: e.target.value})}
                  />
                </div>

                <div className="pt-2">
                  <div className="bg-emerald-50 text-emerald-800 p-4 rounded-xl text-xs mb-4 flex items-start gap-3 border border-emerald-100">
                    <TrendingUp className="w-5 h-5 shrink-0 mt-0.5 text-emerald-600" />
                    <div>
                      <p className="font-bold mb-1">Market Insight</p>
                      <p className="opacity-90">Calculated Price: <strong>KES {(Number(createForm.amount) / Number(createForm.quantity || 1)).toFixed(2)} / kg</strong>. This will affect rolling average trends.</p>
                    </div>
                  </div>
                  <button 
                    disabled={creating}
                    className="w-full bg-emerald-700 hover:bg-emerald-800 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-emerald-700/30 active:scale-[0.98] transition flex justify-center items-center gap-2"
                  >
                    {creating ? <Loader2 className="animate-spin w-5 h-5" /> : (
                      <>
                        <Plus className="w-5 h-5" />
                        {role === 'farmer' ? "List on Market" : "Post Request"}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'wallet' && (
          <WalletView 
            wallet={wallet} 
            transactions={walletTransactions}
            onTopUp={handleTopUp}
            onWithdraw={handleWithdraw}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileView 
            profile={profile}
            userRole={role}
            email={session?.user?.email}
            onUpdateProfile={handleUpdateProfile}
          />
        )}
      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-slate-200/60 p-2 pb-6 max-w-md mx-auto flex justify-around items-center z-40 rounded-t-3xl shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)]">
        <button onClick={() => setActiveTab('dashboard')} className={`p-3 rounded-2xl transition-all duration-300 flex flex-col items-center gap-1 ${activeTab === 'dashboard' ? 'text-emerald-700' : 'text-slate-400 hover:text-slate-600'}`}>
          <Home className={`w-6 h-6 transition-transform ${activeTab === 'dashboard' ? '-translate-y-1' : ''}`} strokeWidth={activeTab === 'dashboard' ? 2.5 : 2} /> 
          <span className={`text-[10px] font-bold transition-opacity ${activeTab === 'dashboard' ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'}`}>Home</span>
        </button>
        <button onClick={() => setActiveTab('market')} className={`p-3 rounded-2xl transition-all duration-300 flex flex-col items-center gap-1 ${activeTab === 'market' ? 'text-emerald-700' : 'text-slate-400 hover:text-slate-600'}`}>
          <Store className={`w-6 h-6 transition-transform ${activeTab === 'market' ? '-translate-y-1' : ''}`} strokeWidth={activeTab === 'market' ? 2.5 : 2} /> 
          <span className={`text-[10px] font-bold transition-opacity ${activeTab === 'market' ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'}`}>Market</span>
        </button>
        <button onClick={() => setActiveTab('create')} className="p-4 bg-slate-900 text-white rounded-full shadow-xl shadow-slate-900/30 transform -translate-y-6 hover:scale-105 transition active:scale-95 border-4 border-slate-50">
          <Plus className="w-7 h-7" />
        </button>
        <button onClick={() => setActiveTab('wallet')} className={`p-3 rounded-2xl transition-all duration-300 flex flex-col items-center gap-1 ${activeTab === 'wallet' ? 'text-emerald-700' : 'text-slate-400 hover:text-slate-600'}`}>
          <Wallet className={`w-6 h-6 transition-transform ${activeTab === 'wallet' ? '-translate-y-1' : ''}`} strokeWidth={activeTab === 'wallet' ? 2.5 : 2} /> 
          <span className={`text-[10px] font-bold transition-opacity ${activeTab === 'wallet' ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'}`}>Wallet</span>
        </button>
        <button onClick={() => setActiveTab('profile')} className={`p-3 rounded-2xl transition-all duration-300 flex flex-col items-center gap-1 ${activeTab === 'profile' ? 'text-emerald-700' : 'text-slate-400 hover:text-slate-600'}`}>
          <User className={`w-6 h-6 transition-transform ${activeTab === 'profile' ? '-translate-y-1' : ''}`} strokeWidth={activeTab === 'profile' ? 2.5 : 2} /> 
          <span className={`text-[10px] font-bold transition-opacity ${activeTab === 'profile' ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'}`}>Profile</span>
        </button>
      </div>

      {/* Transaction Details Modal */}
      {activeTransactionId && (
        <TransactionDetails 
          transaction={transactions.find(t => t.id === activeTransactionId)!}
          role={role}
          userId={session.user.id}
          userEmail={session.user.email}
          onClose={() => setActiveTransactionId(null)}
          onUpdate={handleUpdateStatus}
        />
      )}
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);