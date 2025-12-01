import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
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
  Copy
} from 'https://esm.sh/lucide-react';

// --- Configuration ---
const SUPABASE_URL = 'https://riltljeipcaplvwtejaj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpbHRsamVpcGNhcGx2d3RlamFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2MTAzMzcsImV4cCI6MjA4MDE4NjMzN30.StgCRcE7brtSvTARLsfmWHXNQvPcyRl8WiPUNuY9v0Y';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- Types ---
type UserRole = 'farmer' | 'vendor';
type TransactionStatus = 'pending_deposit' | 'in_escrow' | 'shipped' | 'completed' | 'disputed';

interface Transaction {
  id: string;
  created_at: string;
  title: string;
  amount: number;
  description: string;
  status: TransactionStatus;
  farmer_id: string;
  vendor_id: string;
  vendor_email?: string;
  farmer_email?: string;
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

// 2. Setup Helper (If tables don't exist)
const SetupRequired = () => {
  const [copied, setCopied] = useState(false);
  
  const sql = `-- 1. Create the escrow_transactions table
create table if not exists public.escrow_transactions (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  title text not null,
  amount numeric not null,
  description text,
  status text not null default 'pending_deposit',
  vendor_id uuid references auth.users(id) not null,
  farmer_id uuid references auth.users(id),
  vendor_email text,
  farmer_email text
);

-- 2. Enable Row Level Security (RLS)
alter table public.escrow_transactions enable row level security;

-- 3. Create Access Policies
-- First, drop existing policies to avoid name conflicts if re-running
drop policy if exists "Enable access for authenticated users" on public.escrow_transactions;

-- Allow any logged-in user to view/create/update transactions
create policy "Enable access for authenticated users"
on public.escrow_transactions for all
using (auth.role() = 'authenticated');`;

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
          Database Setup Required
        </h2>
        <p className="text-yellow-700 mb-4 text-sm leading-relaxed">
          To run <strong>Mkulima Express</strong>, you need to create the database table in your Supabase project.
          Please go to the <a href="https://supabase.com/dashboard/project/riltljeipcaplvwtejaj/sql" target="_blank" className="underline font-bold hover:text-yellow-900">Supabase SQL Editor</a> and run this code:
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
            data: { role }, // Saving role in metadata
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

// 4. Transaction Badge Helper
const StatusBadge = ({ status }: { status: TransactionStatus }) => {
  const styles = {
    pending_deposit: 'bg-slate-100 text-slate-600 border-slate-200',
    in_escrow: 'bg-blue-50 text-blue-600 border-blue-200',
    shipped: 'bg-indigo-50 text-indigo-600 border-indigo-200',
    completed: 'bg-green-50 text-green-600 border-green-200',
    disputed: 'bg-red-50 text-red-600 border-red-200',
  };

  const labels = {
    pending_deposit: 'Draft',
    in_escrow: 'Funded',
    shipped: 'Shipped',
    completed: 'Released',
    disputed: 'Disputed',
  };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${styles[status]}`}>
      {labels[status]}
    </span>
  );
};

// 5. Main App Logic
const App = () => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [view, setView] = useState<'list' | 'create' | 'details'>('list');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);

  // Initial Data Load
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        setUserRole(session.user.user_metadata.role || 'vendor');
        fetchTransactions();
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        setUserRole(session.user.user_metadata.role || 'vendor');
        fetchTransactions();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('escrow_transactions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === '42P01') { // Table not found
          setNeedsSetup(true);
        } else {
          console.error('Error fetching transactions:', error);
        }
      } else {
        setTransactions(data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // --- Actions ---

  const createTransaction = async (formData: any) => {
    if (!session) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('escrow_transactions').insert({
        title: formData.title,
        amount: formData.amount,
        description: formData.description,
        vendor_id: session.user.id,
        vendor_email: session.user.email,
        status: 'pending_deposit'
      });
      if (error) throw error;
      setView('list');
      fetchTransactions();
    } catch (e: any) {
      alert(e.message);
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
      
      // Optimistic update
      setTransactions(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t));
      if (selectedTx) setSelectedTx({ ...selectedTx, status: newStatus });
      
    } catch (e: any) {
      alert('Action failed: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const claimTransaction = async (id: string) => {
    if (!session) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('escrow_transactions')
        .update({ 
          farmer_id: session.user.id,
          farmer_email: session.user.email,
          status: 'in_escrow' // Assume instantly agreed for simplicity, or keep pending
        })
        .eq('id', id);
      
      if (error) throw error;
      fetchTransactions();
      setView('list');
    } catch (e: any) {
      alert(e.message);
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
    
    return (
      <div className="p-4 max-w-lg mx-auto pb-24">
        <h2 className="text-xl font-bold mb-6 text-slate-800">New Escrow Contract</h2>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Item Name</label>
            <input 
              className="w-full mt-1 p-3 border rounded-lg bg-slate-50 focus:bg-white transition"
              placeholder="e.g. 500kg Organic Potatoes"
              value={formData.title}
              onChange={e => setFormData({...formData, title: e.target.value})}
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Escrow Amount ($)</label>
            <input 
              type="number"
              className="w-full mt-1 p-3 border rounded-lg bg-slate-50 focus:bg-white transition"
              placeholder="0.00"
              value={formData.amount}
              onChange={e => setFormData({...formData, amount: e.target.value})}
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Terms & Details</label>
            <textarea 
              className="w-full mt-1 p-3 border rounded-lg bg-slate-50 focus:bg-white transition h-32"
              placeholder="Delivery date, quality standards, etc..."
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
            />
          </div>
          <button 
            onClick={() => createTransaction(formData)}
            className="w-full bg-green-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-green-600/20 active:scale-95 transition"
          >
            Create & Fund Escrow
          </button>
          <button onClick={() => setView('list')} className="w-full text-slate-500 py-2">Cancel</button>
        </div>
      </div>
    );
  };

  // Detail View
  const Details = () => {
    if (!selectedTx) return null;
    const isBuyer = session.user.id === selectedTx.vendor_id;
    const isSeller = session.user.id === selectedTx.farmer_id;
    
    // Action Logic
    let primaryAction = null;

    if (selectedTx.status === 'pending_deposit') {
       if (isBuyer) primaryAction = (
         <button 
            onClick={() => updateStatus(selectedTx.id, 'in_escrow')}
            className="w-full bg-green-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"
         >
           <Lock className="w-5 h-5" /> Deposit Funds to Escrow
         </button>
       );
       else if (!isSeller && userRole === 'farmer') primaryAction = (
         <button 
           onClick={() => claimTransaction(selectedTx.id)}
           className="w-full bg-green-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"
         >
           <Sprout className="w-5 h-5" /> Accept Contract
         </button>
       );
    } else if (selectedTx.status === 'in_escrow') {
      if (isSeller) primaryAction = (
        <button 
           onClick={() => updateStatus(selectedTx.id, 'shipped')}
           className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"
        >
          <Truck className="w-5 h-5" /> Mark as Shipped
        </button>
      );
      else primaryAction = <div className="text-center text-slate-500 italic">Waiting for Farmer to ship...</div>;
    } else if (selectedTx.status === 'shipped') {
      if (isBuyer) primaryAction = (
        <button 
           onClick={() => updateStatus(selectedTx.id, 'completed')}
           className="w-full bg-green-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"
        >
          <CheckCircle className="w-5 h-5" /> Release Funds
        </button>
      );
      else primaryAction = <div className="text-center text-slate-500 italic">Goods in transit. Waiting for Buyer approval.</div>;
    }

    return (
      <div className="p-4 pb-24 max-w-lg mx-auto">
        <button onClick={() => setView('list')} className="mb-4 text-slate-500 hover:text-slate-800 flex items-center gap-1 font-medium">
           <ChevronRight className="w-4 h-4 rotate-180" /> Back
        </button>
        
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 bg-slate-900 text-white">
            <h2 className="text-2xl font-bold">{selectedTx.title}</h2>
            <div className="text-3xl font-mono mt-2 text-green-400">${selectedTx.amount}</div>
          </div>
          
          <div className="p-6 space-y-6">
            <div className="flex justify-between items-center p-4 bg-slate-50 rounded-lg">
              <span className="text-slate-500 text-sm font-medium">Status</span>
              <StatusBadge status={selectedTx.status} />
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Contract Terms</h3>
              <p className="text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-lg border border-slate-100">
                {selectedTx.description || "No description provided."}
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Participants</h3>
              <div className="flex flex-col gap-2">
                 <div className="flex items-center gap-3 p-3 border rounded-lg">
                    <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center"><Store className="w-4 h-4" /></div>
                    <div className="overflow-hidden">
                      <p className="text-xs text-slate-500">Vendor (Buyer)</p>
                      <p className="text-sm font-medium truncate">{selectedTx.vendor_email}</p>
                    </div>
                 </div>
                 <div className="flex items-center gap-3 p-3 border rounded-lg">
                    <div className="w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center"><Sprout className="w-4 h-4" /></div>
                    <div className="overflow-hidden">
                      <p className="text-xs text-slate-500">Farmer (Seller)</p>
                      <p className="text-sm font-medium truncate">{selectedTx.farmer_email || 'Waiting for Farmer...'}</p>
                    </div>
                 </div>
              </div>
            </div>
          </div>

          <div className="p-6 bg-slate-50 border-t border-slate-100">
             {primaryAction}
             {selectedTx.status === 'completed' && (
               <div className="text-center text-green-600 font-bold flex items-center justify-center gap-2">
                 <CheckCircle className="w-5 h-5" /> Transaction Completed
               </div>
             )}
          </div>
        </div>
      </div>
    );
  };

  // List View
  const ListView = () => (
    <div className="p-4 pb-24 max-w-lg mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
           <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
           <p className="text-slate-500 text-sm">Welcome to Mkulima Express, {userRole === 'farmer' ? 'Farmer' : 'Vendor'}</p>
        </div>
        <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center text-slate-600">
           <User className="w-6 h-6" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-green-600 p-4 rounded-2xl text-white shadow-lg shadow-green-600/20">
           <p className="text-green-100 text-sm font-medium">In Escrow</p>
           <p className="text-2xl font-bold mt-1">
             ${transactions.filter(t => t.status === 'in_escrow' || t.status === 'shipped').reduce((acc, t) => acc + Number(t.amount), 0).toLocaleString()}
           </p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
           <p className="text-slate-400 text-sm font-medium">Completed</p>
           <p className="text-2xl font-bold mt-1 text-slate-800">
             ${transactions.filter(t => t.status === 'completed').reduce((acc, t) => acc + Number(t.amount), 0).toLocaleString()}
           </p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-slate-800">Recent Transactions</h3>
      </div>

      {transactions.length === 0 ? (
        <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
           <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
             <List className="w-6 h-6" />
           </div>
           <p className="text-slate-500 font-medium">No transactions yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {transactions.map(tx => (
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
                <span className="font-mono font-bold text-slate-800">${tx.amount}</span>
                <StatusBadge status={tx.status} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {view === 'list' && <ListView />}
      {view === 'create' && <CreateForm />}
      {view === 'details' && <Details />}

      {/* Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 flex justify-around items-center z-50 safe-area-bottom">
        <button 
          onClick={() => setView('list')}
          className={`flex flex-col items-center gap-1 ${view === 'list' ? 'text-green-600' : 'text-slate-400'}`}
        >
          <List className="w-6 h-6" />
          <span className="text-[10px] font-medium">Dashboard</span>
        </button>

        <div className="relative -top-6">
          <button 
            onClick={() => setView('create')}
            className="w-14 h-14 bg-green-600 rounded-full shadow-xl shadow-green-600/30 flex items-center justify-center text-white active:scale-95 transition"
          >
            <Plus className="w-7 h-7" />
          </button>
        </div>

        <button 
           onClick={async () => {
             await supabase.auth.signOut();
             setSession(null);
           }}
           className="flex flex-col items-center gap-1 text-slate-400 hover:text-red-500 transition"
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