import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Building2,
  Check,
  ChevronDown,
  LogOut,
  MapPin,
  Menu,
  Search,
  ShieldCheck,
  Star,
  Store,
  TrendingUp,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

type Role = 'admin' | 'user' | 'owner';
type Profile = { id: string; full_name: string; email: string; address: string; role: Role };
type StoreRecord = { id: string; name: string; address: string; owner_id: string | null };
type Rating = { id: string; store_id: string; user_id: string; rating: number; updated_at: string };
type AuthMode = 'sign-in' | 'sign-up';
type View = 'overview' | 'stores' | 'users' | 'account';

const roleCopy: Record<Role, string> = { admin: 'System administrator', user: 'Member', owner: 'Store owner' };

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

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setSession(data.session);
      if (active && !data.session) setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) setSession(nextSession);
      if (!nextSession) {
        setProfile(null);
        setStores([]);
        setRatings([]);
        setLoading(false);
      }
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user.id) return;
    let active = true;
    const loadWorkspace = async () => {
      setDataLoading(true);
      const [profileResult, storesResult, ratingsResult] = await Promise.all([
        supabase.from('profiles').select('id, full_name, email, address, role').eq('id', session.user.id).maybeSingle(),
        supabase.from('stores').select('id, name, address, owner_id').order('name'),
        supabase.from('ratings').select('id, store_id, user_id, rating, updated_at'),
      ]);
      if (!active) return;
      if (profileResult.error || storesResult.error || ratingsResult.error) {
        setError('We could not load your workspace. Please refresh and try again.');
      } else {
        setProfile(profileResult.data as Profile | null);
        setStores((storesResult.data ?? []) as StoreRecord[]);
        setRatings((ratingsResult.data ?? []) as Rating[]);
      }
      setLoading(false);
      setDataLoading(false);
    };
    loadWorkspace();
    return () => {
      active = false;
    };
  }, [session]);

  const refreshData = async () => {
    const [storesResult, ratingsResult] = await Promise.all([
      supabase.from('stores').select('id, name, address, owner_id').order('name'),
      supabase.from('ratings').select('id, store_id, user_id, rating, updated_at'),
    ]);
    if (storesResult.error || ratingsResult.error) {
      setError('We could not refresh the latest information.');
      return;
    }
    setStores((storesResult.data ?? []) as StoreRecord[]);
    setRatings((ratingsResult.data ?? []) as Rating[]);
  };

  if (loading) return <div className="loading-screen"><div className="brand-mark"><Star size={18} fill="currentColor" /></div><span>Loading your workspace</span></div>;
  if (!session) return <AuthScreen />;
  if (!profile) return <div className="loading-screen"><div className="brand-mark"><Star size={18} fill="currentColor" /></div><span>Preparing your profile</span></div>;

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="app-shell">
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
          ? <OwnerOverview profile={profile} stores={stores.filter((store) => store.owner_id === profile.id)} ratings={ratings} onRefresh={refreshData} loading={dataLoading} />
          : <Overview profile={profile} stores={stores} ratings={ratings} onBrowse={() => setView('stores')} onRefresh={refreshData} loading={dataLoading} />)}
        {view === 'stores' && <StoreDirectory profile={profile} stores={stores} ratings={ratings} onRefresh={refreshData} onError={setError} />}
        {view === 'users' && profile.role === 'admin' && <PeopleView />}
        {view === 'account' && <AccountView profile={profile} onSaved={setProfile} onError={setError} />}
      </main>
    </div>
  );
}

function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true); setError(''); setMessage('');
    if (mode === 'sign-up') {
      const trimmedName = name.trim();
      const trimmedAddress = address.trim();
      if (trimmedName.length < 20 || trimmedName.length > 60) {
        setError('Full name must be between 20 and 60 characters.');
        setBusy(false);
        return;
      }
      if (trimmedAddress.length < 5 || trimmedAddress.length > 400) {
        setError('Address must be between 5 and 400 characters.');
        setBusy(false);
        return;
      }
      if (password.length < 8 || password.length > 16 || !/[A-Z]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
        setError('Password must be 8–16 characters and include an uppercase letter and a special character.');
        setBusy(false);
        return;
      }
    }
    const result = mode === 'sign-in'
      ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
      : await supabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name: name.trim(), address: address.trim() } } });
    if (result.error) setError(mode === 'sign-in' ? 'Those details did not match an account.' : 'We could not create your account. Check the details and try again.');
    else if (mode === 'sign-up' && !result.data.session) setMessage('Your account is ready. Check your email if confirmation is required, then sign in.');
    setBusy(false);
  };

  return <div className="auth-layout"><section className="auth-story"><div className="brand brand-light"><div className="brand-mark"><Star size={17} fill="currentColor" /></div><span>ratewell</span></div><div className="story-copy"><p className="eyebrow">A better way to choose well</p><h1>Real experiences.<br /><em>Better decisions.</em></h1><p className="story-text">A trusted home for honest store ratings, thoughtful feedback, and businesses that listen.</p></div><div className="story-footer"><span>Trusted by thoughtful shoppers</span><div className="story-stars">{[1, 2, 3, 4, 5].map((star) => <Star key={star} size={14} fill="currentColor" />)}</div></div></section><section className="auth-panel"><div className="auth-form-wrap"><div className="auth-heading"><span className="eyebrow">Welcome back</span><h2>{mode === 'sign-in' ? 'Sign in to ratewell' : 'Create your account'}</h2><p>{mode === 'sign-in' ? 'Your perspective helps others choose with confidence.' : 'Join a community built on useful, honest feedback.'}</p></div>{error && <div className="alert error-alert"><X size={16} /> {error}</div>}{message && <div className="alert success-alert"><Check size={16} /> {message}</div>}<form onSubmit={submit}>{mode === 'sign-up' && <><label>Full name<input required minLength={20} maxLength={60} value={name} onChange={(event) => setName(event.target.value)} placeholder="Full name (20–60 characters)" /></label><label>Address<input required minLength={5} maxLength={400} value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Where you live" /></label></>}<label>Email address<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label><label>Password<input required minLength={8} maxLength={16} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="8–16 chars, uppercase + special character" /></label><button className="primary-button full-button" disabled={busy}>{busy ? 'Please wait…' : mode === 'sign-in' ? 'Enter workspace' : 'Create account'} <ArrowRight size={17} /></button></form><p className="auth-switch">{mode === 'sign-in' ? 'New to ratewell?' : 'Already have an account?'} <button onClick={() => { setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in'); setError(''); setMessage(''); }}>{mode === 'sign-in' ? 'Create an account' : 'Sign in'}</button></p></div><div className="auth-note"><ShieldCheck size={16} /> Your account and feedback are protected.</div></section></div>;
}

function Overview({ profile, stores, ratings, onBrowse, onRefresh, loading }: { profile: Profile; stores: StoreRecord[]; ratings: Rating[]; onBrowse: () => void; onRefresh: () => Promise<void>; loading: boolean }) {
  const average = ratings.length ? ratings.reduce((sum, item) => sum + item.rating, 0) / ratings.length : 0;
  const myRatings = ratings.filter((rating) => rating.user_id === profile.id);
  const topStores = stores.map((store) => ({ store, ratings: ratings.filter((rating) => rating.store_id === store.id) })).sort((a, b) => averageFor(b.ratings) - averageFor(a.ratings)).slice(0, 3);
  return <div className="page"><div className="page-heading"><div><p className="eyebrow">Good morning, {profile.full_name.split(' ')[0]}</p><h1>Your rating workspace</h1><p className="muted">A clear view of the places and people that shape your neighborhood.</p></div><button className="quiet-button" onClick={onRefresh} disabled={loading}>Refresh data</button></div><div className="stat-grid"><StatCard icon={<Store size={19} />} label="Stores listed" value={stores.length.toString()} detail="Across your directory" accent="green" /><StatCard icon={<Star size={19} />} label="Ratings shared" value={myRatings.length.toString()} detail={profile.role === 'user' ? 'Your contributions' : `${ratings.length} total platform ratings`} accent="amber" /><StatCard icon={<TrendingUp size={19} />} label="Platform average" value={average ? average.toFixed(1) : '—'} detail="Out of 5.0 stars" accent="blue" /></div><div className="content-grid"><section className="panel feature-panel"><div className="panel-header"><div><p className="eyebrow">Explore the directory</p><h2>Find somewhere worth returning to</h2></div><button className="text-button" onClick={onBrowse}>View all <ArrowRight size={15} /></button></div><div className="top-store-list">{topStores.map(({ store, ratings: storeRatings }, index) => <StoreRow key={store.id} store={store} ratings={storeRatings} rank={index + 1} />)}{!topStores.length && <EmptyState text="Stores will appear here once they are added." />}</div></section><section className="panel insight-panel"><div className="insight-icon"><BarChart3 size={19} /></div><p className="eyebrow">A little insight</p><h2>{ratings.length ? 'Your community is paying attention.' : 'Your perspective starts here.'}</h2><p>{ratings.length ? `${ratings.length} ratings are helping people make more confident local choices.` : 'Browse the directory and leave the first rating that helps someone decide.'}</p><button className="primary-button" onClick={onBrowse}>Browse stores <ArrowRight size={16} /></button></section></div><div className="quote-strip"><div className="quote-mark">“</div><p>Good feedback is not just a score. It is a signal that helps a great place get better.</p><span>— The ratewell community</span></div></div>;
}

function OwnerOverview({ profile, stores, ratings, onRefresh, loading }: { profile: Profile; stores: StoreRecord[]; ratings: Rating[]; onRefresh: () => Promise<void>; loading: boolean }) {
  const ownedIds = new Set(stores.map((store) => store.id));
  const ownRatings = ratings.filter((rating) => ownedIds.has(rating.store_id));
  const average = ownRatings.length ? ownRatings.reduce((sum, rating) => sum + rating.rating, 0) / ownRatings.length : 0;
  return <div className="page">
    <div className="page-heading"><div><p className="eyebrow">Store owner workspace</p><h1>Welcome, {profile.full_name.split(' ')[0]}</h1><p className="muted">Track the feedback customers leave for your stores.</p></div><button className="quiet-button" onClick={onRefresh} disabled={loading}>Refresh data</button></div>
    <div className="stat-grid">
      <StatCard icon={<Store size={19} />} label="Your stores" value={stores.length.toString()} detail="Stores assigned to your account" accent="green" />
      <StatCard icon={<Star size={19} />} label="Ratings received" value={ownRatings.length.toString()} detail="Across your assigned stores" accent="amber" />
      <StatCard icon={<TrendingUp size={19} />} label="Average rating" value={average ? average.toFixed(1) : '—'} detail="Out of 5.0 stars" accent="blue" />
    </div>
    <section className="panel feature-panel">
      <div className="panel-header"><div><p className="eyebrow">Customer feedback</p><h2>Your store performance</h2></div><span className="muted">{ownRatings.length} ratings</span></div>
      {!stores.length ? <EmptyState text="No stores are assigned to your account yet. Ask an administrator to assign a store owner." /> : <div className="top-store-list">
        {stores.map((store) => {
          const storeRatings = ratings.filter((rating) => rating.store_id === store.id);
          return <div className="store-row" key={store.id}>
            <div className="store-row-main"><div className="store-icon"><Store size={18} /></div><div><strong>{store.name}</strong><span><MapPin size={13} /> {store.address}</span></div></div>
            <div className="store-row-score"><strong>{averageFor(storeRatings).toFixed(1)} <Star size={14} fill="currentColor" /></strong><span>{storeRatings.length} {storeRatings.length === 1 ? 'rating' : 'ratings'}</span></div>
          </div>;
        })}
      </div>}
    </section>
    <section className="panel feature-panel">
      <div className="panel-header"><div><p className="eyebrow">Latest activity</p><h2>Ratings for your stores</h2></div></div>
      {!ownRatings.length ? <EmptyState text="Customer ratings will appear here when shoppers review your stores." /> : <div className="top-store-list">
        {[...ownRatings].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0, 10).map((rating) => {
          const store = stores.find((item) => item.id === rating.store_id);
          return <div className="store-row" key={rating.id}><div className="store-row-main"><div className="store-icon"><Star size={18} /></div><div><strong>{store?.name || 'Your store'}</strong><span>Updated {new Date(rating.updated_at).toLocaleDateString()}</span></div></div><div className="store-row-score"><strong>{rating.rating}.0 <Star size={14} fill="currentColor" /></strong><span>out of 5</span></div></div>;
        })}
      </div>}
    </section>
  </div>;
}

function StoreDirectory({ profile, stores, ratings, onRefresh, onError }: { profile: Profile; stores: StoreRecord[]; ratings: Rating[]; onRefresh: () => Promise<void>; onError: (message: string) => void }) {
  const [query, setQuery] = useState('');
  const [selectedStore, setSelectedStore] = useState<StoreRecord | null>(null);
  const [sort, setSort] = useState<'name' | 'rating'>('rating');
  const filteredStores = useMemo(() => stores.filter((store) => `${store.name} ${store.address}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : averageFor(ratings.filter((rating) => rating.store_id === b.id)) - averageFor(ratings.filter((rating) => rating.store_id === a.id))), [query, ratings, sort, stores]);
  return <div className="page"><div className="page-heading"><div><p className="eyebrow">The directory</p><h1>Places people talk about</h1><p className="muted">Discover local favorites, then add your own honest perspective.</p></div>{profile.role === 'admin' && <AddStore onAdded={onRefresh} onError={onError} />}</div><div className="directory-toolbar"><div className="search-field"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by store or address" /></div><div className="sort-buttons"><button className={sort === 'rating' ? 'active' : ''} onClick={() => setSort('rating')}>Top rated</button><button className={sort === 'name' ? 'active' : ''} onClick={() => setSort('name')}>A–Z</button></div></div><div className="store-grid">{filteredStores.map((store) => <StoreCard key={store.id} store={store} ratings={ratings.filter((rating) => rating.store_id === store.id)} myRating={ratings.find((rating) => rating.store_id === store.id && rating.user_id === profile.id)} onClick={() => setSelectedStore(store)} />)}{!filteredStores.length && <EmptyState text={query ? 'No stores match your search.' : 'No stores have been added yet.'} />}</div>{selectedStore && <RatingModal store={selectedStore} ratings={ratings.filter((rating) => rating.store_id === selectedStore.id)} myRating={ratings.find((rating) => rating.store_id === selectedStore.id && rating.user_id === profile.id)} onClose={() => setSelectedStore(null)} onSaved={async () => { await onRefresh(); setSelectedStore(null); }} onError={onError} />}</div>;
}

function StoreCard({ store, ratings, myRating, onClick }: { store: StoreRecord; ratings: Rating[]; myRating?: Rating; onClick: () => void }) {
  const average = averageFor(ratings);
  return <button className="store-card" onClick={onClick}><div className="store-card-top"><div className="store-icon"><Building2 size={20} /></div><span className="card-arrow"><ArrowRight size={17} /></span></div><h3>{store.name}</h3><div className="address"><MapPin size={14} /> {store.address}</div><div className="card-divider" /><div className="card-rating"><div className="rating-number">{average ? average.toFixed(1) : '—'} <Star size={15} fill="currentColor" /></div><span>{ratings.length} {ratings.length === 1 ? 'rating' : 'ratings'}</span>{myRating && <span className="your-rating">Your {myRating.rating}/5</span>}</div></button>;
}

function RatingModal({ store, ratings, myRating, onClose, onSaved, onError }: { store: StoreRecord; ratings: Rating[]; myRating?: Rating; onClose: () => void; onSaved: () => Promise<void>; onError: (message: string) => void }) {
  const [value, setValue] = useState(myRating?.rating ?? 0);
  const [busy, setBusy] = useState(false);
  const saveRating = async () => {
    if (!value) return;
    setBusy(true);
    const result = myRating ? await supabase.from('ratings').update({ rating: value, updated_at: new Date().toISOString() }).eq('id', myRating.id) : await supabase.from('ratings').insert({ store_id: store.id, rating: value });
    if (result.error) onError('We could not save that rating. Please try again.'); else await onSaved();
    setBusy(false);
  };
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="rating-modal"><button className="close-button" onClick={onClose}><X size={18} /></button><div className="modal-store-icon"><Building2 size={22} /></div><p className="eyebrow">{myRating ? 'Update your rating' : 'Share your perspective'}</p><h2>{store.name}</h2><div className="modal-address"><MapPin size={15} /> {store.address}</div><div className="modal-summary"><strong>{averageFor(ratings) ? averageFor(ratings).toFixed(1) : '—'}</strong><div><Stars value={Math.round(averageFor(ratings))} /><span>{ratings.length} community ratings</span></div></div><div className="rating-picker"><span>Your rating</span><div>{[1, 2, 3, 4, 5].map((star) => <button key={star} className={star <= value ? 'chosen' : ''} onClick={() => setValue(star)} aria-label={`Rate ${star} out of 5`}><Star size={29} fill="currentColor" /></button>)}</div><small>{value ? ['Needs work', 'Could be better', 'It was good', 'Really enjoyed it', 'Exceptional'][value - 1] : 'Choose from 1 to 5 stars'}</small></div><button className="primary-button full-button" disabled={!value || busy} onClick={saveRating}>{busy ? 'Saving…' : myRating ? 'Update rating' : 'Submit rating'} <Check size={16} /></button></div></div>;
}

function AddStore({ onAdded, onError }: { onAdded: () => Promise<void>; onError: (message: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(''); const [address, setAddress] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => { event.preventDefault(); setBusy(true); const { error } = await supabase.from('stores').insert({ name, address }); if (error) onError('We could not add that store.'); else { setName(''); setAddress(''); setOpen(false); await onAdded(); } setBusy(false); };
  if (!open) return <button className="primary-button" onClick={() => setOpen(true)}><Building2 size={16} /> Add store</button>;
  return <form className="inline-add" onSubmit={submit}><input required minLength={2} value={name} onChange={(event) => setName(event.target.value)} placeholder="Store name" /><input required minLength={5} value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Address" /><button className="primary-button" disabled={busy}>{busy ? 'Adding…' : 'Add'}</button><button type="button" className="icon-button" onClick={() => setOpen(false)}><X size={17} /></button></form>;
}

function PeopleView() {
  const [people, setPeople] = useState<Profile[]>([]);
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<'all' | Role>('all');
  const [sort, setSort] = useState<'name' | 'email'>('name');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let active = true;
    const loadPeople = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, address, role')
        .order('full_name', { ascending: true });
      if (!active) return;
      if (error) setLoadError('Could not load people. Check the administrator permissions and database policies.');
      else setPeople((data || []) as Profile[]);
      setLoading(false);
    };
    void loadPeople();
    return () => { active = false; };
  }, []);

  const filteredPeople = useMemo(() => people
    .filter((person) => role === 'all' || person.role === role)
    .filter((person) => `${person.full_name} ${person.email} ${person.address}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => sort === 'name' ? a.full_name.localeCompare(b.full_name) : a.email.localeCompare(b.email)),
  [people, query, role, sort]);

  return <div className="page">
    <div className="page-heading"><div><p className="eyebrow">Administration</p><h1>People</h1><p className="muted">Review registered members and their assigned access roles.</p></div><div className="account-role"><span>Registered accounts</span><strong>{people.length}</strong></div></div>
    <div className="directory-toolbar">
      <div className="search-field"><Search size={18} /><input aria-label="Search people" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email, or address" /></div>
      <div className="sort-buttons">
        <button className={role === 'all' ? 'active' : ''} onClick={() => setRole('all')}>All roles</button>
        <button className={role === 'user' ? 'active' : ''} onClick={() => setRole('user')}>Members</button>
        <button className={role === 'owner' ? 'active' : ''} onClick={() => setRole('owner')}>Owners</button>
        <button className={role === 'admin' ? 'active' : ''} onClick={() => setRole('admin')}>Admins</button>
      </div>
      <div className="sort-buttons"><button className={sort === 'name' ? 'active' : ''} onClick={() => setSort('name')}>Name A–Z</button><button className={sort === 'email' ? 'active' : ''} onClick={() => setSort('email')}>Email A–Z</button></div>
    </div>
    {loadError && <div className="alert error-alert"><X size={16} /> {loadError}</div>}
    {loading ? <div className="panel empty-panel">Loading people…</div> : <div className="store-grid">
      {filteredPeople.map((person) => <article className="panel account-card" key={person.id}>
        <div className="profile-large"><div className="avatar large-avatar">{person.full_name.charAt(0).toUpperCase()}</div><div><h2>{person.full_name}</h2><p>{person.email}</p></div></div>
        <div className="account-role"><span>Role</span><strong>{roleCopy[person.role]}</strong></div>
        <p className="muted">{person.address}</p>
      </article>)}
      {!filteredPeople.length && <div className="panel empty-panel"><div className="empty-icon"><Users size={23} /></div><h2>No people found</h2><p>Try another search or role filter.</p></div>}
    </div>}
  </div>;
}

function AccountView({ profile, onSaved, onError }: { profile: Profile; onSaved: (profile: Profile) => void; onError: (message: string) => void }) { const [name, setName] = useState(profile.full_name); const [address, setAddress] = useState(profile.address); const [busy, setBusy] = useState(false); const [saved, setSaved] = useState(false); const save = async (event: FormEvent) => { event.preventDefault(); setBusy(true); const { data, error } = await supabase.from('profiles').update({ full_name: name, address }).eq('id', profile.id).select('id, full_name, email, address, role').maybeSingle(); if (error || !data) onError('We could not save your account details.'); else { onSaved(data as Profile); setSaved(true); setTimeout(() => setSaved(false), 2500); } setBusy(false); }; return <div className="page"><div className="page-heading"><div><p className="eyebrow">Your account</p><h1>Keep your profile current</h1><p className="muted">This information helps keep your ratewell experience personal.</p></div></div><div className="account-layout"><section className="panel account-card"><div className="profile-large"><div className="avatar large-avatar">{profile.full_name.charAt(0).toUpperCase()}</div><div><h2>{profile.full_name}</h2><p>{roleCopy[profile.role]}</p></div></div><form onSubmit={save} className="account-form"><label>Full name<input required minLength={20} maxLength={60} value={name} onChange={(event) => setName(event.target.value)} /></label><label>Email address<input disabled value={profile.email} /></label><label>Address<input required minLength={5} maxLength={400} value={address} onChange={(event) => setAddress(event.target.value)} /></label><button className="primary-button" disabled={busy}>{busy ? 'Saving…' : saved ? 'Saved' : 'Save changes'} <Check size={16} /></button></form></section><section className="panel account-side"><ShieldCheck size={22} /><h3>Built for trust</h3><p>Your ratings are connected to your account so every review represents a real community member.</p><div className="account-role"><span>Current access</span><strong>{roleCopy[profile.role]}</strong></div></section></div></div>; }

function NavButton({ icon, label, active, onClick }: { icon: ReactNode; label: string; active: boolean; onClick: () => void }) { return <button className={`nav-button ${active ? 'active' : ''}`} onClick={onClick}>{icon}<span>{label}</span>{active && <span className="nav-active-dot" />}</button>; }
function StatCard({ icon, label, value, detail, accent }: { icon: ReactNode; label: string; value: string; detail: string; accent: string }) { return <div className={`stat-card ${accent}`}><div className="stat-icon">{icon}</div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>; }
function StoreRow({ store, ratings, rank }: { store: StoreRecord; ratings: Rating[]; rank: number }) { return <div className="store-row"><span className="rank">0{rank}</span><div className="row-store-icon"><Building2 size={17} /></div><div className="row-store-info"><strong>{store.name}</strong><span>{store.address}</span></div><div className="row-rating"><strong>{averageFor(ratings) ? averageFor(ratings).toFixed(1) : '—'}</strong><Stars value={Math.round(averageFor(ratings))} /></div></div>; }
function Stars({ value }: { value: number }) { return <span className="stars">{[1, 2, 3, 4, 5].map((star) => <Star key={star} size={13} fill={star <= value ? 'currentColor' : 'none'} />)}</span>; }
function EmptyState({ text }: { text: string }) { return <div className="empty-state"><div className="empty-icon"><Store size={20} /></div><p>{text}</p></div>; }
function averageFor(items: Rating[]) { return items.length ? items.reduce((sum, item) => sum + item.rating, 0) / items.length : 0; }

export default App;
