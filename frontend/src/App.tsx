import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight, BarChart3, Building2, Check, ChevronDown, LogOut, MapPin, Menu,
  Search, ShieldCheck, Star, Store, TrendingUp, UserRound, Users, X,
} from 'lucide-react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

type Role = 'admin' | 'user' | 'owner';
type Profile = { id: string; full_name: string; email: string; address: string; role: Role };
type StoreRecord = {
  id: string; name: string; address: string; owner_id: string | null;
  rating: number | null; rating_count: number; user_rating: number | null; user_rating_id: string | null;
};
type Rating = { id: string; store_id: string; user_id: string; rating: number; updated_at: string; reviewer?: { full_name: string; email: string } | null };
type AuthMode = 'sign-in' | 'sign-up';
type View = 'overview' | 'stores' | 'users' | 'account';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const roleCopy: Record<Role, string> = { admin: 'System administrator', user: 'Member', owner: 'Store owner' };

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Authentication required.');
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Request failed.');
  return body as T;
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stores, setStores] = useState<StoreRecord[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [view, setView] = useState<View>('overview');
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [adminStats, setAdminStats] = useState<{ users: number; stores: number; ratings: number } | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => { if (active) { setSession(data.session); if (!data.session) setLoading(false); } });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      if (active) setSession(next);
      if (!next) { setProfile(null); setStores([]); setRatings([]); setAdminStats(null); setLoading(false); }
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  const loadWorkspace = async () => {
    if (!session) return;
    setDataLoading(true); setError('');
    try {
      const me = await api<{ profile: Profile }>('/me');
      const storeResponse = await api<{ stores: StoreRecord[] }>('/stores?sort=name&order=asc');
      setProfile(me.profile);
      setStores(storeResponse.stores);
      if (me.profile.role === 'admin') {
        setAdminStats(await api<{ users: number; stores: number; ratings: number }>('/dashboard'));
      } else if (me.profile.role === 'owner') {
        const owner = await api<{ stores: StoreRecord[]; ratings: Rating[]; average_rating: number | null }>('/owner/dashboard');
        setStores(owner.stores.map(s => ({ ...s, user_rating: null, user_rating_id: null })));
        setRatings(owner.ratings);
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'We could not load your workspace.'); }
    finally { setLoading(false); setDataLoading(false); }
  };

  useEffect(() => { void loadWorkspace(); }, [session]);

  const refreshData = async () => {
    if (!session) return;
    try {
      const storeResponse = await api<{ stores: StoreRecord[] }>('/stores?sort=name&order=asc');
      setStores(storeResponse.stores);
      if (profile?.role === 'admin') setAdminStats(await api('/dashboard'));
      if (profile?.role === 'owner') {
        const owner = await api<{ stores: StoreRecord[]; ratings: Rating[] }>('/owner/dashboard');
        setStores(owner.stores.map(s => ({ ...s, user_rating: null, user_rating_id: null })));
        setRatings(owner.ratings);
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'We could not refresh the latest information.'); }
  };

  if (loading) return <Loading text="Loading your workspace" />;
  if (!session) return <AuthScreen />;
  if (!profile) return <Loading text="Preparing your profile" />;

  const signOut = async () => { await supabase.auth.signOut(); };
  return <div className="app-shell">
    <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
      <div className="brand"><div className="brand-mark"><Star size={17} fill="currentColor" /></div><span>ratewell</span></div>
      <div className="workspace-label">Workspace</div>
      <nav>
        <NavButton icon={<BarChart3 size={18} />} label="Overview" active={view === 'overview'} onClick={() => { setView('overview'); setMenuOpen(false); }} />
        <NavButton icon={<Store size={18} />} label="Store directory" active={view === 'stores'} onClick={() => { setView('stores'); setMenuOpen(false); }} />
        {profile.role === 'admin' && <NavButton icon={<Users size={18} />} label="People" active={view === 'users'} onClick={() => { setView('users'); setMenuOpen(false); }} />}
        <NavButton icon={<UserRound size={18} />} label="My account" active={view === 'account'} onClick={() => { setView('account'); setMenuOpen(false); }} />
      </nav>
      <div className="sidebar-bottom">
        <div className="mini-profile"><div className="avatar">{profile.full_name.charAt(0).toUpperCase()}</div><div><strong>{profile.full_name}</strong><span>{roleCopy[profile.role]}</span></div></div>
        <button className="logout-button" onClick={signOut}><LogOut size={17} /> Sign out</button>
      </div>
    </aside>
    {menuOpen && <button className="mobile-scrim" aria-label="Close menu" onClick={() => setMenuOpen(false)} />}
    <main className="main-content">
      <header className="topbar"><button className="mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu size={21} /></button><div className="breadcrumb">Workspace <span>/</span> {view === 'overview' ? 'Overview' : view === 'stores' ? 'Store directory' : view === 'users' ? 'People' : 'My account'}</div><div className="topbar-role"><span className="status-dot" /> {roleCopy[profile.role]} <ChevronDown size={15} /></div></header>
      {error && <div className="alert error-alert"><X size={17} /> {error}<button onClick={() => setError('')}><X size={15} /></button></div>}
      {view === 'overview' && (profile.role === 'owner'
        ? <OwnerOverview profile={profile} stores={stores} ratings={ratings} onRefresh={refreshData} loading={dataLoading} />
        : <Overview profile={profile} stores={stores} stats={adminStats} onBrowse={() => setView('stores')} onRefresh={refreshData} loading={dataLoading} />)}
      {view === 'stores' && <StoreDirectory profile={profile} stores={stores} onRefresh={refreshData} onError={setError} />}
      {view === 'users' && profile.role === 'admin' && <PeopleView onError={setError} />}
      {view === 'account' && <AccountView profile={profile} onSaved={setProfile} onError={setError} />}
    </main>
  </div>;
}

function Loading({ text }: { text: string }) { return <div className="loading-screen"><div className="brand-mark"><Star size={18} fill="currentColor" /></div><span>{text}</span></div>; }

function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [name, setName] = useState(''); const [address, setAddress] = useState('');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [error, setError] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    if (mode === 'sign-up') {
      if (name.trim().length < 20 || name.trim().length > 60) { setError('Full name must be between 20 and 60 characters.'); setBusy(false); return; }
      if (address.trim().length > 400) { setError('Address must be at most 400 characters.'); setBusy(false); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Enter a valid email address.'); setBusy(false); return; }
      if (!/^(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,16}$/.test(password)) { setError('Password must be 8–16 characters and include an uppercase letter and a special character.'); setBusy(false); return; }
    }
    const result = mode === 'sign-in'
      ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
      : await supabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name: name.trim(), address: address.trim() } } });
    if (result.error) setError(mode === 'sign-in' ? 'Those details did not match an account.' : result.error.message);
    else if (mode === 'sign-up' && !result.data.session) setMessage('Account created. Check your email if confirmation is enabled, then sign in.');
    setBusy(false);
  };
  return <div className="auth-layout"><section className="auth-story"><div className="brand brand-light"><div className="brand-mark"><Star size={17} fill="currentColor" /></div><span>ratewell</span></div><div className="story-copy"><p className="eyebrow">A better way to choose well</p><h1>Real experiences.<br /><em>Better decisions.</em></h1><p className="story-text">A trusted home for honest store ratings, thoughtful feedback, and businesses that listen.</p></div><div className="story-footer"><span>Trusted by thoughtful shoppers</span><div className="story-stars">{[1,2,3,4,5].map(s => <Star key={s} size={14} fill="currentColor" />)}</div></div></section><section className="auth-panel"><div className="auth-form-wrap"><div className="auth-heading"><span className="eyebrow">Welcome back</span><h2>{mode === 'sign-in' ? 'Sign in to ratewell' : 'Create your account'}</h2><p>{mode === 'sign-in' ? 'Your perspective helps others choose with confidence.' : 'Join a community built on useful, honest feedback.'}</p></div>{error && <div className="alert error-alert"><X size={16} /> {error}</div>}{message && <div className="alert success-alert"><Check size={16} /> {message}</div>}<form onSubmit={submit}>{mode === 'sign-up' && <><label>Full name<input required minLength={20} maxLength={60} value={name} onChange={e=>setName(e.target.value)} placeholder="Full name (20–60 characters)" /></label><label>Address<input required maxLength={400} value={address} onChange={e=>setAddress(e.target.value)} placeholder="Where you live" /></label></>}<label>Email address<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" /></label><label>Password<input required minLength={8} maxLength={16} type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="8–16 chars, uppercase + special character" /></label><button className="primary-button full-button" disabled={busy}>{busy ? 'Please wait…' : mode === 'sign-in' ? 'Enter workspace' : 'Create account'} <ArrowRight size={17} /></button></form><p className="auth-switch">{mode === 'sign-in' ? 'New to ratewell?' : 'Already have an account?'} <button onClick={()=>{setMode(mode==='sign-in'?'sign-up':'sign-in');setError('');setMessage('');}}>{mode === 'sign-in' ? 'Create an account' : 'Sign in'}</button></p></div><div className="auth-note"><ShieldCheck size={16} /> Your account and feedback are protected.</div></section></div>;
}

function Overview({ profile, stores, stats, onBrowse, onRefresh, loading }: { profile: Profile; stores: StoreRecord[]; stats: {users:number;stores:number;ratings:number}|null; onBrowse:()=>void; onRefresh:()=>Promise<void>; loading:boolean }) {
  const average = stores.filter(s=>s.rating !== null).length ? stores.filter(s=>s.rating !== null).reduce((a,s)=>a+(s.rating||0),0)/stores.filter(s=>s.rating !== null).length : 0;
  const myRatings = stores.filter(s=>s.user_rating !== null).length;
  const topStores = [...stores].sort((a,b)=>(b.rating||0)-(a.rating||0)).slice(0,3);
  return <div className="page"><div className="page-heading"><div><p className="eyebrow">Good morning, {profile.full_name.split(' ')[0]}</p><h1>Your rating workspace</h1><p className="muted">A clear view of the places and people that shape your neighborhood.</p></div><button className="quiet-button" onClick={onRefresh} disabled={loading}>Refresh data</button></div><div className="stat-grid"><StatCard icon={<Store size={19}/>} label="Stores listed" value={(stats?.stores ?? stores.length).toString()} detail="Across your directory" accent="green"/><StatCard icon={<Star size={19}/>} label={profile.role==='admin'?'Ratings shared':'Your ratings'} value={(profile.role==='admin' ? (stats?.ratings ?? 0) : myRatings).toString()} detail={profile.role==='admin'?'Total platform ratings':'Your contributions'} accent="amber"/><StatCard icon={<TrendingUp size={19}/>} label="Platform average" value={average?average.toFixed(1):'—'} detail="Out of 5.0 stars" accent="blue"/></div>{profile.role==='admin' && <div className="stat-grid"><StatCard icon={<Users size={19}/>} label="Registered users" value={(stats?.users ?? 0).toString()} detail="All roles" accent="green"/></div>}<div className="content-grid"><section className="panel feature-panel"><div className="panel-header"><div><p className="eyebrow">Explore the directory</p><h2>Find somewhere worth returning to</h2></div><button className="text-button" onClick={onBrowse}>View all <ArrowRight size={15}/></button></div><div className="top-store-list">{topStores.map((store,i)=><StoreRow key={store.id} store={store} rank={i+1}/>)}{!topStores.length&&<EmptyState text="Stores will appear here once they are added."/>}</div></section><section className="panel insight-panel"><div className="insight-icon"><BarChart3 size={19}/></div><p className="eyebrow">A little insight</p><h2>{stores.length?'Your community is paying attention.':'Your perspective starts here.'}</h2><p>{stores.length?'Browse stores and see the latest community ratings.':'Browse the directory and leave the first rating that helps someone decide.'}</p><button className="primary-button" onClick={onBrowse}>Browse stores <ArrowRight size={16}/></button></section></div></div>;
}

function OwnerOverview({ profile, stores, ratings, onRefresh, loading }: { profile:Profile; stores:StoreRecord[]; ratings:Rating[]; onRefresh:()=>Promise<void>; loading:boolean }) {
  const average=ratings.length?ratings.reduce((a,r)=>a+r.rating,0)/ratings.length:0;
  return <div className="page"><div className="page-heading"><div><p className="eyebrow">Store owner workspace</p><h1>Welcome, {profile.full_name.split(' ')[0]}</h1><p className="muted">Track the feedback customers leave for your stores.</p></div><button className="quiet-button" onClick={onRefresh} disabled={loading}>Refresh data</button></div><div className="stat-grid"><StatCard icon={<Store size={19}/>} label="Your stores" value={stores.length.toString()} detail="Stores assigned to you" accent="green"/><StatCard icon={<Star size={19}/>} label="Ratings received" value={ratings.length.toString()} detail="Across your stores" accent="amber"/><StatCard icon={<TrendingUp size={19}/>} label="Average rating" value={average?average.toFixed(1):'—'} detail="Out of 5.0 stars" accent="blue"/></div><section className="panel feature-panel"><div className="panel-header"><div><p className="eyebrow">Customer feedback</p><h2>Ratings for your stores</h2></div></div>{!ratings.length?<EmptyState text={stores.length?'Customer ratings will appear here when shoppers review your stores.':'No stores are assigned to your account yet.'}/>:<div className="top-store-list">{ratings.slice(0,10).map(r=>{const store=stores.find(s=>s.id===r.store_id);return <div className="store-row" key={r.id}><div className="store-row-main"><div className="store-icon"><Star size={18}/></div><div><strong>{r.reviewer?.full_name||'Customer'} · {store?.name||'Your store'}</strong><span>{r.reviewer?.email||'Customer review'} · Updated {new Date(r.updated_at).toLocaleDateString()}</span></div></div><div className="store-row-score"><strong>{r.rating}.0 <Star size={14} fill="currentColor"/></strong><span>out of 5</span></div></div>})}</div>}</section></div>;
}

function StoreDirectory({ profile, stores, onRefresh, onError }: { profile:Profile; stores:StoreRecord[]; onRefresh:()=>Promise<void>; onError:(m:string)=>void }) {
  const [query,setQuery]=useState(''); const [selected,setSelected]=useState<StoreRecord|null>(null); const [sort,setSort]=useState<'name'|'rating'>('rating');
  const filtered=useMemo(()=>stores.filter(s=>`${s.name} ${s.address}`.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>sort==='name'?a.name.localeCompare(b.name):(b.rating||0)-(a.rating||0)),[query,sort,stores]);
  return <div className="page"><div className="page-heading"><div><p className="eyebrow">The directory</p><h1>Places people talk about</h1><p className="muted">Discover local favorites, then add your own honest perspective.</p></div>{profile.role==='admin'&&<AddStore onAdded={onRefresh} onError={onError}/>}</div><div className="directory-toolbar"><div className="search-field"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search by store or address"/></div><div className="sort-buttons"><button className={sort==='rating'?'active':''} onClick={()=>setSort('rating')}>Top rated</button><button className={sort==='name'?'active':''} onClick={()=>setSort('name')}>A–Z</button></div></div><div className="store-grid">{filtered.map(store=><StoreCard key={store.id} store={store} onClick={()=>setSelected(store)}/>)}{!filtered.length&&<EmptyState text={query?'No stores match your search.':'No stores have been added yet.'}/>}</div>{selected&&<RatingModal store={selected} onClose={()=>setSelected(null)} onSaved={async()=>{await onRefresh();setSelected(null);}} onError={onError}/>}</div>;
}

function StoreCard({store,onClick}:{store:StoreRecord;onClick:()=>void}) { return <button className="store-card" onClick={onClick}><div className="store-card-top"><div className="store-icon"><Building2 size={20}/></div><span className="card-arrow"><ArrowRight size={17}/></span></div><h3>{store.name}</h3><div className="address"><MapPin size={14}/> {store.address}</div><div className="card-divider"/><div className="card-rating"><div className="rating-number">{store.rating===null?'—':store.rating.toFixed(1)} <Star size={15} fill="currentColor"/></div><span>{store.rating_count} {store.rating_count===1?'rating':'ratings'}</span>{store.user_rating!==null&&<span className="your-rating">Your {store.user_rating}/5</span>}</div></button>; }

function RatingModal({store,onClose,onSaved,onError}:{store:StoreRecord;onClose:()=>void;onSaved:()=>Promise<void>;onError:(m:string)=>void}) {
  const [value,setValue]=useState(store.user_rating??0); const [busy,setBusy]=useState(false);
  const save=async()=>{if(!value)return;setBusy(true);try{if(store.user_rating_id) await api(`/ratings/${store.user_rating_id}`,{method:'PUT',body:JSON.stringify({rating:value})});else await api('/ratings',{method:'POST',body:JSON.stringify({storeId:store.id,rating:value})});await onSaved();}catch(e){onError(e instanceof Error?e.message:'We could not save that rating.');}finally{setBusy(false);}};
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><div className="rating-modal"><button className="close-button" onClick={onClose}><X size={18}/></button><div className="modal-store-icon"><Building2 size={22}/></div><p className="eyebrow">{store.user_rating_id?'Update your rating':'Share your perspective'}</p><h2>{store.name}</h2><div className="modal-address"><MapPin size={15}/> {store.address}</div><div className="modal-summary"><strong>{store.rating===null?'—':store.rating.toFixed(1)}</strong><div><Stars value={Math.round(store.rating||0)}/><span>{store.rating_count} community ratings</span></div></div><div className="rating-picker"><span>Your rating</span><div>{[1,2,3,4,5].map(s=><button key={s} className={s<=value?'chosen':''} onClick={()=>setValue(s)} aria-label={`Rate ${s} out of 5`}><Star size={29} fill="currentColor"/></button>)}</div><small>{value?['Needs work','Could be better','It was good','Really enjoyed it','Exceptional'][value-1]:'Choose from 1 to 5 stars'}</small></div><button className="primary-button full-button" disabled={!value||busy} onClick={save}>{busy?'Saving…':store.user_rating_id?'Update rating':'Submit rating'} <Check size={16}/></button></div></div>;
}

function AddStore({onAdded,onError}:{onAdded:()=>Promise<void>;onError:(m:string)=>void}) {
  const [open,setOpen]=useState(false); const [name,setName]=useState(''); const [address,setAddress]=useState(''); const [ownerId,setOwnerId]=useState(''); const [owners,setOwners]=useState<Profile[]>([]); const [busy,setBusy]=useState(false);
  useEffect(()=>{if(open) void api<{users:Profile[]}>('/users?role=owner&sort=full_name&order=asc').then(x=>setOwners(x.users)).catch(()=>setOwners([]));},[open]);
  const submit=async(e:FormEvent)=>{e.preventDefault();setBusy(true);try{await api('/stores',{method:'POST',body:JSON.stringify({name,address,ownerId:ownerId||null})});setName('');setAddress('');setOwnerId('');setOpen(false);await onAdded();}catch(err){onError(err instanceof Error?err.message:'We could not add that store.');}finally{setBusy(false);}};
  if(!open)return <button className="primary-button" onClick={()=>setOpen(true)}><Building2 size={16}/> Add store</button>;
  return <form className="inline-add" onSubmit={submit}><input required minLength={2} maxLength={60} value={name} onChange={e=>setName(e.target.value)} placeholder="Store name"/><input required maxLength={400} value={address} onChange={e=>setAddress(e.target.value)} placeholder="Address"/><select value={ownerId} onChange={e=>setOwnerId(e.target.value)}><option value="">No owner assigned</option>{owners.map(o=><option key={o.id} value={o.id}>{o.full_name}</option>)}</select><button className="primary-button" disabled={busy}>{busy?'Adding…':'Add'}</button><button type="button" className="icon-button" onClick={()=>setOpen(false)}><X size={17}/></button></form>;
}

function PeopleView({onError}:{onError:(m:string)=>void}) {
  const [people,setPeople]=useState<Profile[]>([]); const [showAdd,setShowAdd]=useState(false); const [query,setQuery]=useState(''); const [role,setRole]=useState<'all'|Role>('all'); const [sort,setSort]=useState<'name'|'email'>('name'); const [loading,setLoading]=useState(true);
  const load=async()=>{try{const r=await api<{users:Profile[]}>('/users?sort=full_name&order=asc');setPeople(r.users);}catch(e){onError(e instanceof Error?e.message:'Could not load people.');}finally{setLoading(false);}};
  useEffect(()=>{void load();},[]);
  const filtered=useMemo(()=>people.filter(p=>role==='all'||p.role===role).filter(p=>`${p.full_name} ${p.email} ${p.address}`.toLowerCase().includes(query.trim().toLowerCase())).sort((a,b)=>sort==='name'?a.full_name.localeCompare(b.full_name):a.email.localeCompare(b.email)),[people,query,role,sort]);
  return <div className="page"><div className="page-heading"><div><p className="eyebrow">Administration</p><h1>People</h1><p className="muted">Review registered members and their assigned access roles.</p></div><div className="account-role"><span>Registered accounts</span><strong>{people.length}</strong></div><button className="primary-button" onClick={()=>setShowAdd(v=>!v)}><Users size={16}/> {showAdd?'Close':'Add user'}</button></div>{showAdd&&<AddUser onAdded={async()=>{setShowAdd(false);await load();}} onError={onError}/>} <div className="directory-toolbar"><div className="search-field"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search name, email, or address"/></div><div className="sort-buttons">{(['all','user','owner','admin'] as const).map(r=><button key={r} className={role===r?'active':''} onClick={()=>setRole(r)}>{r==='all'?'All roles':r==='user'?'Members':r==='owner'?'Owners':'Admins'}</button>)}</div><div className="sort-buttons"><button className={sort==='name'?'active':''} onClick={()=>setSort('name')}>Name A–Z</button><button className={sort==='email'?'active':''} onClick={()=>setSort('email')}>Email A–Z</button></div></div>{loading?<div className="panel empty-panel">Loading people…</div>:<div className="store-grid">{filtered.map(p=><article className="panel account-card" key={p.id}><div className="profile-large"><div className="avatar large-avatar">{p.full_name.charAt(0).toUpperCase()}</div><div><h2>{p.full_name}</h2><p>{p.email}</p></div></div><div className="account-role"><span>Role</span><strong>{roleCopy[p.role]}</strong></div><p className="muted">{p.address}</p></article>)}{!filtered.length&&<div className="panel empty-panel"><div className="empty-icon"><Users size={23}/></div><h2>No people found</h2><p>Try another search or role filter.</p></div>}</div>}</div>;
}

function AddUser({onAdded,onError}:{onAdded:()=>Promise<void>;onError:(m:string)=>void}) {
  const [name,setName]=useState(''); const [email,setEmail]=useState(''); const [address,setAddress]=useState(''); const [password,setPassword]=useState(''); const [role,setRole]=useState<Role>('user'); const [busy,setBusy]=useState(false);
  const submit=async(e:FormEvent)=>{e.preventDefault();setBusy(true);try{await api('/users',{method:'POST',body:JSON.stringify({name,email,address,password,role})});setName('');setEmail('');setAddress('');setPassword('');setRole('user');await onAdded();}catch(err){onError(err instanceof Error?err.message:'Could not create user.');}finally{setBusy(false);}};
  return <form className="panel account-form" onSubmit={submit}><div className="panel-header"><div><p className="eyebrow">Create account</p><h2>Add a user</h2></div></div><label>Full name<input required minLength={20} maxLength={60} value={name} onChange={e=>setName(e.target.value)}/></label><label>Email<input required type="email" value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Address<input required maxLength={400} value={address} onChange={e=>setAddress(e.target.value)}/></label><label>Password<input required minLength={8} maxLength={16} type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="8–16 chars, uppercase + special"/></label><label>Role<select value={role} onChange={e=>setRole(e.target.value as Role)}><option value="user">Normal user</option><option value="owner">Store owner</option><option value="admin">System administrator</option></select></label><button className="primary-button" disabled={busy}>{busy?'Creating…':'Create user'} <Check size={16}/></button></form>;
}

function AccountView({profile,onSaved,onError}:{profile:Profile;onSaved:(p:Profile)=>void;onError:(m:string)=>void}) {
  const [name,setName]=useState(profile.full_name); const [address,setAddress]=useState(profile.address); const [newPassword,setNewPassword]=useState(''); const [busy,setBusy]=useState(false); const [passwordBusy,setPasswordBusy]=useState(false); const [saved,setSaved]=useState(false);
  const save=async(e:FormEvent)=>{e.preventDefault();setBusy(true);try{const r=await api<{profile:Profile}>('/profile',{method:'PATCH',body:JSON.stringify({name,address})});onSaved(r.profile);setSaved(true);setTimeout(()=>setSaved(false),2500);}catch(err){onError(err instanceof Error?err.message:'We could not save your account details.');}finally{setBusy(false);}};
  return <div className="page"><div className="page-heading"><div><p className="eyebrow">Your account</p><h1>Keep your profile current</h1><p className="muted">Update the information linked to your account.</p></div></div><div className="account-layout"><section className="panel account-card"><div className="profile-large"><div className="avatar large-avatar">{profile.full_name.charAt(0).toUpperCase()}</div><div><h2>{profile.full_name}</h2><p>{roleCopy[profile.role]}</p></div></div><form onSubmit={save} className="account-form"><label>Full name<input required minLength={20} maxLength={60} value={name} onChange={e=>setName(e.target.value)}/></label><label>Email address<input disabled value={profile.email}/></label><label>Address<input required maxLength={400} value={address} onChange={e=>setAddress(e.target.value)}/></label><button className="primary-button" disabled={busy}>{busy?'Saving…':saved?'Saved':'Save changes'} <Check size={16}/></button></form><div className="account-form"><label>New password<input type="password" minLength={8} maxLength={16} value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="8–16 chars, uppercase + special"/></label><button type="button" className="quiet-button" disabled={!newPassword||passwordBusy} onClick={async()=>{setPasswordBusy(true);try{await api('/password',{method:'PATCH',body:JSON.stringify({password:newPassword})});setNewPassword('');setSaved(true);setTimeout(()=>setSaved(false),2500);}catch(err){onError(err instanceof Error?err.message:'Password could not be updated.');}finally{setPasswordBusy(false);}}}>{passwordBusy?'Updating…':'Update password'}</button></div></section><section className="panel account-side"><ShieldCheck size={22}/><h3>Built for trust</h3><p>Your ratings are connected to your account so every review represents a real community member.</p><div className="account-role"><span>Current access</span><strong>{roleCopy[profile.role]}</strong></div></section></div></div>;
}

function NavButton({icon,label,active,onClick}:{icon:ReactNode;label:string;active:boolean;onClick:()=>void}){return <button className={`nav-button ${active?'active':''}`} onClick={onClick}>{icon}<span>{label}</span>{active&&<span className="nav-active-dot"/>}</button>;}
function StatCard({icon,label,value,detail,accent}:{icon:ReactNode;label:string;value:string;detail:string;accent:string}){return <div className={`stat-card ${accent}`}><div className="stat-icon">{icon}</div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;}
function StoreRow({store,rank}:{store:StoreRecord;rank:number}){return <div className="store-row"><span className="rank">0{rank}</span><div className="row-store-icon"><Building2 size={17}/></div><div className="row-store-info"><strong>{store.name}</strong><span>{store.address}</span></div><div className="row-rating"><strong>{store.rating===null?'—':store.rating.toFixed(1)}</strong><Stars value={Math.round(store.rating||0)}/></div></div>;}
function Stars({value}:{value:number}){return <span className="stars">{[1,2,3,4,5].map(s=><Star key={s} size={13} fill={s<=value?'currentColor':'none'}/>)}</span>;}
function EmptyState({text}:{text:string}){return <div className="empty-state"><div className="empty-icon"><Store size={20}/></div><p>{text}</p></div>;}
export default App;
