import React, { useState, useEffect, useCallback, useMemo } from 'react';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [user, setUser] = useState(null);
  const [currentView, setCurrentView] = useState(localStorage.getItem('currentView') || 'landing');
  const [toasts, setToasts] = useState([]);
  const [modal, setModal] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [hasActiveCustomerOrder, setHasActiveCustomerOrder] = useState(false);

  const addToast = (message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  const showAlert = (title, message) => setModal({ title, message, type: 'info' });
  
  const showConfirm = (title, message, onConfirm) => setModal({ 
    title, message, type: 'confirm', onConfirm: () => { onConfirm(); setModal(null); } 
  });

  const [selectedRestaurant, setSelectedRestaurant] = useState(() => {
    const saved = localStorage.getItem('selectedRestaurant');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    if (selectedRestaurant) localStorage.setItem('selectedRestaurant', JSON.stringify(selectedRestaurant));
    else localStorage.removeItem('selectedRestaurant');
  }, [selectedRestaurant]);

  const [cart, setCart] = useState(() => {
    const saved = localStorage.getItem('cart');
    return saved ? JSON.parse(saved) : { restaurant_id: null, items: [] };
  });

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart));
  }, [cart]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCuisine, setSelectedCuisine] = useState(null); // Fixed logic: it's cuisine not category

  const apiFetch = useCallback(async (path, options = {}) => {
    if (!token && !path.includes('/api/auth') && !path.includes('/api/restaurants')) return null;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const baseUrl = window.location.origin;
    const fullPath = path.startsWith('http') ? path : `${baseUrl}${path}`;
    
    try {
      const response = await fetch(fullPath, { ...options, headers: { ...headers, ...options.headers } });
      const contentType = response.headers.get("content-type");
      let data;
      if (contentType && contentType.includes("application/json")) data = await response.json();
      else {
        const text = await response.text();
        data = text ? { detail: text } : {};
      }
      if (!response.ok) throw new Error(data?.detail || 'API Error');
      return data;
    } catch (err) {
      if (err.message === "Failed to fetch") throw new Error("Connection lost.");
      throw err;
    }
  }, [token]);

  useEffect(() => {
    const initAuth = async () => {
      if (token) {
        try {
          const userData = await apiFetch('/api/users/me');
          if (userData) {
            setUser(userData);
            if (currentView === 'landing' || currentView === 'login' || currentView === 'register') {
               setCurrentView(userData.role === 'restaurant' ? 'admin' : 'home');
            }
          } else handleLoggedOut();
        } catch { handleLoggedOut(); }
      }
      setIsInitializing(false);
    };
    initAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, apiFetch]);

  // Auth Guard
  useEffect(() => {
    const protectedViews = ['home', 'restaurant', 'checkout', 'orders', 'admin'];
    if (!isInitializing && !token && protectedViews.includes(currentView)) {
      setCurrentView('landing');
    }
  }, [token, currentView, isInitializing]);

  useEffect(() => { localStorage.setItem('currentView', currentView); }, [currentView]);

  // Global Customer Order Monitor
  useEffect(() => {
    if (!token || !user || user.role === 'restaurant') return;
    const checkOrders = async () => {
      try {
        const data = await apiFetch('/api/orders');
        if (Array.isArray(data)) {
           const active = data.filter(o => o.is_paid && o.status !== 'delivered' && o.status !== 'cancelled').length;
           setHasActiveCustomerOrder(active > 0);
        }
      } catch (e) { console.error(e); }
    };
    checkOrders();
    const inv = setInterval(checkOrders, 20000);
    return () => clearInterval(inv);
  }, [token, user, apiFetch]);

  const handleLoggedOut = () => {
    setToken(null); setUser(null);
    localStorage.clear();
    setCurrentView('landing');
  };

  if (isInitializing) return <PageLoader />;

  return (
    <div className="min-h-screen bg-[#FDFCFB] flex flex-col font-sans text-gray-900 overflow-x-hidden relative">
      <style>{`
        @keyframes custom-pulse {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 92, 0, 0.4); }
          70% { transform: scale(1.1); box-shadow: 0 0 0 10px rgba(255, 92, 0, 0); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 92, 0, 0); }
        }
        .animate-status-pulse { animation: custom-pulse 2s infinite; }
      `}</style>

      <NavBar 
        user={user} onNavigate={setCurrentView} onLogout={handleLoggedOut} currentView={currentView} 
        cartCount={cart.items.reduce((sum, i) => sum + i.quantity, 0)} 
        customerAlert={hasActiveCustomerOrder}
      />

      <main className="flex-1">
        {currentView === 'landing' && <LandingView onStart={() => setCurrentView(token ? (user?.role === 'restaurant' ? 'admin' : 'home') : 'register')} />}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {currentView === 'login' && <Login onLogin={(t, u) => { setToken(t); localStorage.setItem('token', t); setUser(u); }} onSwitch={() => setCurrentView('register')} apiFetch={apiFetch} />}
          {currentView === 'register' && <Register onRegister={(t, u) => { setToken(t); localStorage.setItem('token', t); setUser(u); }} onSwitch={() => setCurrentView('login')} apiFetch={apiFetch} />}
          {currentView === 'home' && <Home apiFetch={apiFetch} onSelect={(r) => { setSelectedRestaurant(r); setCurrentView('restaurant'); }} searchQuery={searchQuery} setSearchQuery={setSearchQuery} selectedCuisine={selectedCuisine} setSelectedCuisine={setSelectedCuisine} />}
          {currentView === 'restaurant' && <RestaurantView apiFetch={apiFetch} restaurant={selectedRestaurant} cart={cart} setCart={setCart} onCheckout={() => setCurrentView('checkout')} onBack={() => setCurrentView('home')} addToast={addToast} />}
          {currentView === 'checkout' && <CheckoutView apiFetch={apiFetch} cart={cart} setCart={setCart} onOrderPlaced={() => setCurrentView('orders')} showAlert={showAlert} showConfirm={showConfirm} onBrowse={() => setCurrentView('home')} />}
          {currentView === 'orders' && <OrdersView apiFetch={apiFetch} showConfirm={showConfirm} showAlert={showAlert} />}
          {currentView === 'admin' && <MerchantPortal apiFetch={apiFetch} user={user} showAlert={showAlert} showConfirm={showConfirm} addToast={addToast} />}
        </div>
      </main>
      
      <div className="fixed bottom-8 right-8 z-[9999] flex flex-col gap-4">
        {toasts.map(t => (
          <div key={t.id} className={`${t.type === 'error' ? 'bg-red-600' : 'bg-gray-900'} text-white px-6 py-4 rounded-2xl shadow-2xl font-black text-sm animate-in slide-in-from-right duration-300 flex items-center gap-3`}>
             <span className="text-xl">{t.type === 'error' ? '🚫' : '🔥'}</span> {t.message}
          </div>
        ))}
      </div>

      {modal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] shadow-2xl p-10 max-w-sm w-full animate-in zoom-in-95 duration-200 border border-gray-100">
            <h3 className="text-2xl font-black text-gray-900 mb-4 tracking-tight">{modal.title}</h3>
            <p className="text-gray-400 font-medium mb-8 leading-relaxed">{modal.message}</p>
            <div className="flex gap-3">
              {modal.type === 'confirm' && (
                <button onClick={() => setModal(null)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-500 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all">Cancel</button>
              )}
              <button onClick={modal.type === 'confirm' ? modal.onConfirm : () => setModal(null)} className={`flex-1 ${modal.type === 'confirm' ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-900 hover:bg-black'} text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg`}>{modal.type === 'confirm' ? 'Yes, proceed' : 'Got it'}</button>
            </div>
          </div>
        </div>
      )}
      <Footer />
    </div>
  );
}

const PageLoader = () => (
  <div className="fixed inset-0 bg-white flex flex-col items-center justify-center p-20 z-[999]">
    <div className="w-16 h-16 border-4 border-gray-100 border-t-[#FF5C00] rounded-full animate-spin mb-6"></div>
    <span className="text-2xl font-black tracking-tighter text-gray-200">FoodByte</span>
  </div>
);

const LandingView = ({ onStart }) => (
  <div className="bg-white pt-32 pb-12 sm:pt-40 sm:pb-20">
    <div className="mx-auto max-w-7xl px-6 lg:px-8 text-center">
        <div className="mb-4 flex justify-center"><span className="rounded-full px-4 py-1.5 text-sm font-black text-[#FF5C00] ring-1 ring-inset ring-[#FF5C00]/20 bg-orange-50/50 uppercase tracking-widest">Premium Network</span></div>
        <h1 className="text-6xl font-black tracking-tighter text-gray-900 sm:text-8xl">Gourmet meals, <br/>delivered <span className="text-[#FF5C00]">instantly.</span></h1>
        <p className="mt-10 text-xl font-medium leading-relaxed text-gray-400 max-w-xl mx-auto">The professional choice for local fine dining.</p>
        <div className="mt-12"><button onClick={onStart} className="rounded-full bg-gray-900 px-10 py-5 text-lg font-black text-white shadow-2xl hover:bg-black transition-all transform hover:scale-105">Start Your Order</button></div>
    </div>
  </div>
);

const NavBar = ({ user, currentView, onNavigate, onLogout, cartCount, customerAlert }) => (
  <nav className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-gray-100">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex justify-between">
        <div className="flex items-center space-x-8">
          <button onClick={() => onNavigate('landing')} className="flex items-center space-x-2">
            <span className="bg-[#FF5C00] text-white w-10 h-10 flex items-center justify-center rounded-lg font-black text-2xl">F</span>
            <span className="text-2xl font-black tracking-tighter text-gray-900">FoodByte</span>
          </button>
          {user && (
            <div className="hidden lg:flex items-center space-x-6 text-sm font-bold text-gray-500 uppercase tracking-widest">
              {user.role !== 'restaurant' && <button onClick={() => onNavigate('home')} className={currentView === 'home' ? 'text-[#FF5C00]' : 'hover:text-gray-900'}>Browse</button>}
              {user.role !== 'restaurant' && (
                 <button onClick={() => onNavigate('orders')} className={`relative flex items-center gap-2 ${currentView === 'orders' ? 'text-[#FF5C00]' : 'hover:text-gray-900'}`}>
                    History {customerAlert && <span className="flex h-1.5 w-1.5 rounded-full bg-[#FF5C00] animate-pulse"></span>}
                 </button>
              )}
              {user.role === 'restaurant' && <button onClick={() => onNavigate('admin')} className={currentView === 'admin' ? 'text-[#FF5C00]' : 'hover:text-gray-900'}>Merchant Portal</button>}
            </div>
          )}
        </div>
        <div className="flex items-center space-x-4">
          {user ? (
            <div className="flex items-center space-x-4">
              {user.role !== 'restaurant' && (
                <button disabled={cartCount === 0} onClick={() => onNavigate('checkout')} className={`relative p-2 transition-all ${cartCount === 0 ? 'opacity-30 cursor-not-allowed text-gray-300' : 'text-gray-400 hover:text-[#FF5C00]'}`}>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>
                  {cartCount > 0 && <span className="absolute -top-1 -right-1 bg-[#FF5C00] text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full font-bold ring-2 ring-white">{cartCount}</span>}
                </button>
              )}
              <div className="h-10 border-l border-gray-200 mx-2 hidden sm:block"></div>
              <div className="flex flex-col items-end hidden sm:flex"><span className="text-sm font-black text-gray-900">{user.name}</span><span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter opacity-70">{user.role}</span></div>
              <button onClick={onLogout} className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-5 py-2 rounded-full text-sm font-bold transition-all">Sign Out</button>
            </div>
          ) : (
            <div className="flex items-center space-x-3"><button onClick={() => onNavigate('login')} className="text-gray-600 px-6 py-2 text-sm font-bold">Login</button><button onClick={() => onNavigate('register')} className="bg-[#FF5C00] hover:bg-[#E55200] text-white px-6 py-2 rounded-full text-sm font-bold shadow-lg shadow-orange-100">Sign Up</button></div>
          )}
        </div>
    </div>
  </nav>
);

const Pagination = ({ current, total, onChange }) => {
  if (total <= 1) return null;
  return (<div className="flex items-center justify-center space-x-2 pt-10">{[...Array(total)].map((_, i) => (<button key={i} onClick={() => onChange(i + 1)} className={`w-10 h-10 rounded-xl font-black text-sm transition-all ${current === i + 1 ? 'bg-gray-900 text-white shadow-xl' : 'bg-white text-gray-400 border border-gray-100'}`}>{i + 1}</button>))}</div>);
};

const Home = ({ apiFetch, onSelect, searchQuery, setSearchQuery, selectedCuisine, setSelectedCuisine }) => {
  const [restaurants, setRestaurants] = useState([]); const [categories, setCategories] = useState([]); const [loading, setLoading] = useState(true); const [page, setPage] = useState(1); const itemsPerPage = 6;
  useEffect(() => { const load = async () => { try { const [resData, catData] = await Promise.all([apiFetch('/api/restaurants'), apiFetch('/api/restaurants/categories')]); if (resData) setRestaurants(resData); if (catData) setCategories(catData); } catch (e) { console.error(e); } finally { setLoading(false); } }; load(); }, [apiFetch]);
  const filtered = useMemo(() => restaurants.filter(r => (!searchQuery || r.name.toLowerCase().includes(searchQuery.toLowerCase()) || r.cuisine.toLowerCase().includes(searchQuery.toLowerCase())) && (!selectedCuisine || r.cuisine === selectedCuisine)), [restaurants, searchQuery, selectedCuisine]);
  const paginated = filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage); const totalPages = Math.ceil(filtered.length / itemsPerPage);
  if (loading) return <PageLoader />;
  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6"><div><h2 className="text-4xl font-black text-gray-900 tracking-tight">Browse Kitchens.</h2><p className="text-gray-400 font-medium mt-1">Order from {restaurants.length}+ favorites.</p></div><div className="relative group w-full md:w-96"><input type="text" placeholder="Search kitchens..." className="w-full bg-white border-2 border-gray-100 focus:border-[#FF5C00] rounded-2xl p-4 pl-12 shadow-sm transition-all outline-none font-medium" value={searchQuery} onChange={e => {setSearchQuery(e.target.value); setPage(1);}} /><svg className="w-5 h-5 text-gray-300 absolute left-4 top-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg></div></div>
      <div className="flex items-center space-x-3 overflow-x-auto pb-4 no-scrollbar"><button onClick={() => {setSelectedCuisine(null); setPage(1);}} className={`flex-shrink-0 px-6 py-2.5 rounded-full text-sm font-bold transition-all ${!selectedCuisine ? 'bg-[#FF5C00] text-white shadow-lg' : 'bg-white text-gray-500 border border-gray-100'}`}>All Kitchens</button>{categories.map(cat => (<button key={cat} onClick={() => {setSelectedCuisine(cat); setPage(1);}} className={`flex-shrink-0 px-6 py-2.5 rounded-full text-sm font-bold transition-all ${selectedCuisine === cat ? 'bg-[#FF5C00] text-white shadow-lg' : 'bg-white text-gray-500 border border-gray-100'}`}>{cat}</button>))}</div>
      {filtered.length === 0 ? (<div className="bg-white p-20 rounded-3xl text-center border-2 border-dashed border-gray-100"><span className="text-6xl mb-6 block">🍽️</span><h3 className="text-xl font-bold text-gray-800">No matches found</h3></div>) : (<><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">{paginated.map(r => (<div key={r.id} onClick={() => r.is_open && onSelect(r)} className={`bg-white rounded-[2.5rem] shadow-sm transition-all overflow-hidden group border border-gray-50 flex flex-col h-full transform duration-500 ${r.is_open ? 'hover:shadow-2xl cursor-pointer hover:-translate-y-2' : 'opacity-60 grayscale cursor-not-allowed'}`}><div className="h-64 relative overflow-hidden"><img src={r.image_url} alt={r.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 brightness-90" /><div className="absolute top-6 left-6 flex gap-2"><span className="bg-white/90 backdrop-blur-md text-gray-900 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-sm">{r.cuisine}</span>{!r.is_open && <span className="bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-sm">Closed</span>}</div></div><div className="p-8 flex-1 flex flex-col"><h3 className="text-2xl font-black text-gray-900 group-hover:text-[#FF5C00] transition-colors">{r.name}</h3><p className="text-sm text-gray-400 mt-4 leading-relaxed truncate">{r.address}</p></div></div>))}</div><Pagination current={page} total={totalPages} onChange={setPage} /></>)}
    </div>
  );
};

const RestaurantView = ({ apiFetch, restaurant, cart, setCart, onCheckout, onBack, addToast }) => {
  const [fullRestaurant, setFullRestaurant] = useState(null); const [loading, setLoading] = useState(true); const [searchQuery, setSearchQuery] = useState(''); const [page, setPage] = useState(1); const itemsPerPage = 4;
  useEffect(() => { const fetchFresh = async () => { setLoading(true); try { const data = await apiFetch(`/api/restaurants/${restaurant.id}`); if (data) setFullRestaurant(data); } catch (e) { console.error(e); } finally { setLoading(false); } }; if (restaurant?.id) fetchFresh(); }, [restaurant?.id, apiFetch]);
  const filteredMenu = useMemo(() => fullRestaurant?.menu.filter(item => item.is_available && (item.name.toLowerCase().includes(searchQuery.toLowerCase()) || (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase())))) || [], [fullRestaurant, searchQuery]);
  const addToCart = (item) => { setCart(prev => { let newState; if (prev.restaurant_id !== restaurant.id) newState = { restaurant_id: restaurant.id, items: [{ ...item, quantity: 1 }] }; else { const existing = prev.items.find(i => i.item_id === item.item_id); if (existing) newState = { ...prev, items: prev.items.map(i => i.item_id === item.item_id ? { ...i, quantity: i.quantity + 1 } : i) }; else newState = { ...prev, items: [...prev.items, { ...item, quantity: 1 }] }; } addToast(`Added ${item.name}`); return newState; }); };
  const removeFromCart = (itemId) => { setCart(prev => ({ ...prev, items: prev.items.map(i => i.item_id === itemId ? { ...i, quantity: i.quantity - 1 } : i).filter(i => i.quantity > 0) })); };
  if (loading) return <PageLoader />;
  if (!fullRestaurant) return null;
  const paginatedMenu = filteredMenu.slice((page - 1) * itemsPerPage, page * itemsPerPage); const totalPages = Math.ceil(filteredMenu.length / itemsPerPage); const cartTotal = cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  return (
    <div className="flex flex-col lg:flex-row gap-12 items-start">
      <div className="flex-1 space-y-8 w-full"><button onClick={onBack} className="flex items-center text-gray-400 hover:text-gray-900 font-bold group transition-colors tracking-widest text-[10px] uppercase"><svg className="w-4 h-4 mr-2 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>Back to kitchens</button>
        <div className="relative h-96 rounded-[3rem] overflow-hidden shadow-2xl"><img src={fullRestaurant.image_url} alt={fullRestaurant.name} className="w-full h-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/40 to-transparent p-12 flex flex-col justify-end"><h1 className="text-6xl font-black text-white tracking-tighter mb-4">{fullRestaurant.name}</h1><span className="bg-[#FF5C00] text-white w-fit px-4 py-1.5 rounded-full font-black uppercase tracking-widest text-sm">{fullRestaurant.cuisine}</span></div></div>
        <div className="space-y-10 pt-10"><div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b-4 border-gray-100 pb-6"><div className="flex items-center gap-4"><h2 className="text-3xl font-black text-gray-900 tracking-tight">Crafted Menu.</h2>{!fullRestaurant.is_open && <span className="bg-red-50 text-red-500 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest animate-pulse">Kitchen Closed</span>}</div><div className="relative group w-full md:w-72"><input type="text" placeholder="Search menu..." className="w-full bg-white border-2 border-gray-100 focus:border-[#FF5C00] rounded-2xl p-3 pl-10 shadow-sm outline-none font-bold text-sm transition-all" value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setPage(1); }} /><svg className="w-4 h-4 text-gray-300 absolute left-3.5 top-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg></div></div>
          {filteredMenu.length === 0 ? (<div className="bg-gray-50 p-20 rounded-3xl text-center border-2 border-dashed border-gray-200 text-gray-400 font-bold">No items found.</div>) : (<><div className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${!fullRestaurant.is_open ? 'opacity-40 grayscale pointer-events-none' : ''}`}>{paginatedMenu.map(item => (<div key={item.item_id} className="bg-white border border-gray-100 p-8 rounded-[2rem] flex justify-between items-center group hover:border-[#FF5C00] transition-colors shadow-sm"><div className="flex-1 pr-6"><h4 className="text-xl font-black text-gray-900 mb-1">{item.name}</h4><p className="text-sm text-gray-400 font-medium truncate">{item.description}</p><p className="text-[#FF5C00] font-black text-xl mt-4">${item.price.toFixed(2)}</p></div><button disabled={!fullRestaurant.is_open} onClick={() => addToCart(item)} className="w-14 h-14 rounded-2xl bg-gray-50 group-hover:bg-[#FF5C00] group-hover:text-white text-gray-300 flex items-center justify-center transition-all shadow-sm"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg></button></div>))}</div><Pagination current={page} total={totalPages} onChange={setPage} /></>)}
        </div>
      </div>
      <div className="w-full lg:w-[400px] flex-shrink-0"><div className="bg-white rounded-[3rem] shadow-2xl border border-gray-100 p-10"><h3 className="text-2xl font-black text-gray-900 mb-8 tracking-tight">My Tray</h3>{cart.items.length === 0 ? (<div className="py-20 text-center text-gray-300 space-y-4 text-center"><span className="text-5xl block opacity-30">🚲</span><p className="font-bold text-gray-400">Empty tray.</p><button onClick={onBack} className="text-[#FF5C00] font-black uppercase tracking-widest text-[10px] hover:underline pt-4">Start browsing</button></div>) : (<div className="space-y-6"><div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2 no-scrollbar">{cart.items.map(item => (<div key={item.item_id} className="flex justify-between items-center"><div className="flex-1 pr-4"><p className="font-black text-gray-900 text-sm">{item.name}</p><p className="text-xs font-bold text-[#FF5C00] opacity-80">${item.price.toFixed(2)}</p></div><div className="flex items-center space-x-3 bg-gray-50 rounded-xl p-1 border border-gray-100"><button onClick={() => removeFromCart(item.item_id)} className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-500 font-black">-</button><span className="w-4 text-center font-black text-xs">{item.quantity}</span><button onClick={() => addToCart(item)} className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-[#FF5C00] font-black">+</button></div></div>))}</div><div className="border-t border-gray-100 pt-8 space-y-4 flex justify-between items-end"><span className="text-2xl font-black text-gray-900 tracking-tighter">Total</span><span className="text-3xl font-black text-[#FF5C00] tracking-tighter">${(cartTotal + 2.99).toFixed(2)}</span></div><button onClick={onCheckout} className="w-full bg-[#FF5C00] hover:bg-[#E55200] text-white py-5 rounded-2xl font-black text-lg transition-all shadow-xl shadow-orange-100">Checkout</button></div>)}</div></div>
    </div>
  );
};

const CheckoutView = ({ apiFetch, cart, setCart, onOrderPlaced, showAlert, showConfirm, onBrowse }) => {
  const [addresses, setAddresses] = useState([]); const [selectedAddr, setSelectedAddr] = useState(null); const [newAddr, setNewAddr] = useState({ label: 'Home', address: '' }); const [editingAddrId, setEditingAddrId] = useState(null); const [editForm, setEditForm] = useState({ label: '', address: '' }); const [pendingOrder, setPendingOrder] = useState(null); const [isPaying, setIsPaying] = useState(false); const [loading, setLoading] = useState(true);
  const fetchInitialData = useCallback(async () => { try { const [addrData, orderData] = await Promise.all([apiFetch('/api/users/me/addresses'), apiFetch('/api/orders')]); if (addrData) setAddresses(addrData); const unpaid = Array.isArray(orderData) ? orderData.find(o => !o.is_paid && o.status === 'pending') : null; setPendingOrder(unpaid); if (!selectedAddr && addrData?.length > 0) { const def = addrData.find(a => a.is_default) || addrData[0]; setSelectedAddr(def.id); } } catch (e) { showAlert("Load Error", e.message); } finally { setLoading(false); } }, [apiFetch, selectedAddr, showAlert]);
  useEffect(() => { fetchInitialData(); }, [fetchInitialData]);
  const handleAddAddr = async (e) => { e.preventDefault(); if (!newAddr.address.trim()) return; try { const added = await apiFetch('/api/users/me/addresses', { method: 'POST', body: JSON.stringify(newAddr) }); if (added) { setAddresses([added, ...addresses]); setSelectedAddr(added.id); setNewAddr({ label: 'Home', address: '' }); } } catch (e) { showAlert("Address Error", e.message); } };
  const handleUpdateAddr = async (e) => { e.preventDefault(); try { const updated = await apiFetch(`/api/users/me/addresses/${editingAddrId}`, { method: 'PATCH', body: JSON.stringify(editForm) }); if (updated) { setAddresses(addresses.map(a => a.id === editingAddrId ? updated : a)); setEditingAddrId(null); } } catch (e) { showAlert("Update Error", e.message); } };
  const handleDeleteAddr = (id) => { showConfirm("Delete Address", "Remove this location?", async () => { try { await apiFetch(`/api/users/me/addresses/${id}`, { method: 'DELETE' }); setAddresses(addresses.filter(a => a.id !== id)); if (selectedAddr === id) setSelectedAddr(null); } catch (e) { showAlert("Delete Error", e.message); } }); };
  const handlePlaceOrder = async () => {
    if (!pendingOrder && !selectedAddr) return showAlert("Select Location", "Please select a delivery address.");
    setIsPaying(true); try {
      let orderId = pendingOrder?.id; let restaurantId = pendingOrder?.restaurant_id || cart.restaurant_id; const restaurant = await apiFetch(`/api/restaurants/${restaurantId}`); if (!restaurant?.is_open) throw new Error("Kitchen closed.");
      if (!orderId) { const addr = addresses.find(a => a.id === selectedAddr); const order = await apiFetch('/api/orders', { method: 'POST', body: JSON.stringify({ restaurant_id: cart.restaurant_id, items: cart.items.map(i => ({ item_id: i.item_id, quantity: i.quantity })), delivery_address: addr.address }) }); orderId = order.id; }
      await apiFetch(`/api/orders/${orderId}/pay`, { method: 'POST' }); setCart({ restaurant_id: null, items: [] }); onOrderPlaced();
    } catch (e) { showAlert("Order Failed", e.message); } finally { setIsPaying(false); }
  };
  const handleCancelPending = () => { showConfirm("Cancel Pending", "Discard this unpaid order?", async () => { try { await apiFetch(`/api/orders/${pendingOrder.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'cancelled' }) }); setPendingOrder(null); } catch (e) { showAlert("Error", e.message); } }); };
  if (loading) return <PageLoader />;
  const subtotal = pendingOrder ? pendingOrder.total_price : cart.items.reduce((s, i) => s + i.price * i.quantity, 0);
  const isCartEmpty = !pendingOrder && cart.items.length === 0;
  if (isCartEmpty) return (<div className="max-w-xl mx-auto py-20 text-center space-y-8 animate-in fade-in zoom-in duration-500"><div className="w-32 h-32 bg-gray-50 rounded-full flex items-center justify-center mx-auto text-6xl grayscale opacity-30 shadow-inner">🚲</div><div><h2 className="text-4xl font-black text-gray-900 tracking-tight mb-2">Empty Tray.</h2><p className="text-gray-400 font-medium leading-relaxed">Delicious things await.</p></div><button onClick={onBrowse} className="bg-gray-900 text-white px-10 py-5 rounded-full text-lg font-black hover:bg-black transition-all transform hover:scale-105 shadow-2xl">Start Browsing</button></div>);
  return (
    <div className="max-w-3xl mx-auto space-y-12">
      <h2 className="text-4xl font-black text-gray-900 tracking-tight text-center">{pendingOrder ? 'Complete Payment.' : 'Checkout.'}</h2>
      {pendingOrder && (<div className="bg-orange-50 border-2 border-orange-100 p-8 rounded-[2.5rem] flex flex-col md:flex-row justify-between items-center gap-6 animate-in fade-in zoom-in duration-500"><div><h3 className="text-xl font-black text-orange-600 mb-2 tracking-tight">Pending Order</h3><p className="text-orange-400 font-bold text-sm">Finish payment or start fresh.</p></div><button onClick={handleCancelPending} className="bg-white text-red-400 px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest border border-red-50 hover:bg-red-50 transition-all">Cancel Order</button></div>)}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <div className="space-y-8"><div className={`bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 ${pendingOrder ? 'opacity-40 grayscale pointer-events-none' : ''}`}><h3 className="text-xl font-black mb-6 flex items-center tracking-tight"><span className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center mr-3 text-sm">1</span>Delivery Location</h3><div className="space-y-4">{addresses.map(a => (<div key={a.id} onClick={() => !editingAddrId && setSelectedAddr(a.id)} className={`p-5 rounded-2xl border-2 transition-all relative group ${selectedAddr === a.id ? 'border-[#FF5C00] bg-orange-50/10' : 'border-gray-100 hover:border-gray-200'} ${editingAddrId === a.id ? 'cursor-default' : 'cursor-pointer'}`}>{editingAddrId === a.id ? (<form onSubmit={handleUpdateAddr} className="space-y-3"><div className="flex gap-2">{['Home', 'Work', 'Other'].map(l => (<button key={l} type="button" onClick={() => setEditForm({...editForm, label: l})} className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${editForm.label === l ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-400'}`}>{l}</button>))}</div><input autoFocus className="w-full bg-white border border-gray-200 rounded-xl p-2 text-xs font-bold outline-none focus:ring-1 focus:ring-orange-200" value={editForm.address} onChange={e => setEditForm({...editForm, address: e.target.value})} /><div className="flex gap-2"><button type="submit" className="bg-gray-900 text-white px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest">Save</button><button type="button" onClick={() => setEditingAddrId(null)} className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Cancel</button></div></form>) : (<><div className="flex items-center justify-between mb-1"><span className="font-black text-sm uppercase tracking-wider">{a.label}</span><div className="flex items-center gap-2"><button onClick={(e) => { e.stopPropagation(); setEditingAddrId(a.id); setEditForm({ label: a.label, address: a.address }); }} className="opacity-0 group-hover:opacity-100 text-[#FF5C00] text-[10px] font-black uppercase tracking-widest transition-all">Edit</button><button onClick={(e) => { e.stopPropagation(); handleDeleteAddr(a.id); }} className="opacity-0 group-hover:opacity-100 text-red-400 text-[10px] font-black uppercase tracking-widest transition-all">Delete</button>{a.is_default && <span className="text-[10px] bg-gray-100 text-gray-400 px-2 py-0.5 rounded font-black uppercase">Default</span>}</div></div><p className="text-sm text-gray-400 font-medium">{a.address}</p></>)}</div>))}
              <form onSubmit={handleAddAddr} className="pt-4 border-t border-gray-100 border-dashed space-y-4"><div className="flex gap-2">{['Home', 'Work', 'Other'].map(l => (<button key={l} type="button" onClick={() => setNewAddr({...newAddr, label: l})} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${newAddr.label === l ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>{l}</button>))}</div><input type="text" placeholder="Street address..." className="w-full bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm outline-none focus:ring-2 focus:ring-orange-200 font-bold" value={newAddr.address} onChange={e => setNewAddr({...newAddr, address: e.target.value})} />{newAddr.address.trim() && <button type="submit" className="w-full bg-[#FF5C00] text-white py-3 rounded-xl text-sm font-black uppercase tracking-widest shadow-lg shadow-orange-50">Save Address</button>}</form></div></div></div>
        <div className="space-y-8"><div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100"><h3 className="text-xl font-black mb-6 flex items-center tracking-tight"><span className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center mr-3 text-sm">2</span>Payment</h3><div className="p-5 rounded-2xl border-2 border-[#FF5C00] bg-orange-50/10 flex items-center space-x-4"><div className="w-12 h-12 bg-[#FF5C00]/10 text-[#FF5C00] flex items-center justify-center rounded-xl font-black text-xs">P.P</div><div className="flex-1"><p className="font-black text-sm text-[#FF5C00]">Point to Point</p><p className="text-xs font-bold text-orange-400">Direct debit simulated</p></div></div></div><div className="bg-white p-10 rounded-[3rem] shadow-sm border border-gray-100 space-y-8"><h3 className="text-xl font-black flex items-center tracking-tight"><span className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center mr-3 text-sm">3</span>Final Summary</h3>
             <div className="space-y-4"><div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-gray-300"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div><div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-gray-300"><span>Delivery Fee</span><span>$2.99</span></div><div className="pt-6 border-t border-gray-50 flex justify-between items-end"><span className="text-2xl font-black text-gray-900 tracking-tighter">Total</span><span className="text-4xl font-black text-[#FF5C00] tracking-tighter">${(subtotal + (pendingOrder ? 0 : 2.99)).toFixed(2)}</span></div></div>
             <button disabled={isPaying || (!pendingOrder && !selectedAddr) || subtotal === 0} onClick={handlePlaceOrder} className="w-full bg-gray-900 hover:bg-black text-white py-6 rounded-[2rem] font-black text-xl transition-all transform hover:scale-[1.02] flex justify-center items-center gap-3 disabled:opacity-50 shadow-xl">{isPaying ? <Spinner /> : <><span className="text-2xl">⚡</span> {pendingOrder ? 'Pay Now' : 'Confirm & Pay'}</>}</button>
          </div></div>
      </div>
    </div>
  );
};

const OrdersView = ({ apiFetch, showConfirm, showAlert }) => {
  const [orders, setOrders] = useState([]); const [loading, setLoading] = useState(true); const [expandedOrderId, setExpandedOrderId] = useState(null);
  const fetchOrders = useCallback(async () => { try { const data = await apiFetch('/api/orders'); if (data) setOrders(Array.isArray(data) ? data.filter(o => o.is_paid) : []); } catch (e) { console.error(e); } finally { setLoading(false); } }, [apiFetch]);
  const handleCancelOrder = (e, orderId) => { e.stopPropagation(); showConfirm("Cancel Order", "Terminate order?", async () => { try { await apiFetch(`/api/orders/${orderId}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'cancelled' }) }); fetchOrders(); } catch (e) { showAlert("Error", e.message); } }); };
  useEffect(() => { fetchOrders(); const interval = setInterval(fetchOrders, 30000); return () => clearInterval(interval); }, [fetchOrders]);
  if (loading) return <PageLoader />;
  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-20"><div className="flex justify-between items-end"><div><h2 className="text-4xl font-black text-gray-900 tracking-tight">Track Your Journey.</h2><p className="text-gray-400 font-medium">Real-time status.</p></div><button onClick={fetchOrders} className="text-[#FF5C00] hover:bg-orange-50 px-4 py-2 rounded-xl text-sm font-black uppercase tracking-wider transition-colors font-black">Refresh</button></div>
      {orders.length === 0 ? (<div className="bg-white p-20 rounded-[3rem] text-center border-2 border-dashed border-gray-100 font-bold text-gray-300 uppercase tracking-tighter">Empty history.</div>) : (
        <div className="space-y-8">{orders.map(order => (
          <div key={order.id} onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)} className={`bg-white p-10 rounded-[2.5rem] shadow-sm border border-gray-50 group hover:shadow-2xl transition-all duration-500 cursor-pointer ${expandedOrderId === order.id ? 'ring-2 ring-[#FF5C00] shadow-2xl' : ''}`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10"><div className="flex-1"><div className="flex items-center space-x-4 mb-2"><span className="font-black text-2xl text-gray-900 group-hover:text-[#FF5C00] transition-colors uppercase">Order #{order.id.toString().substring(0,8)}</span>{order.status === 'cancelled' ? (<span className="bg-red-50 text-red-600 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-red-100">Cancelled</span>) : order.is_paid ? (<span className="bg-green-50 text-green-600 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-green-100">Paid</span>) : (<span className="bg-orange-50 text-orange-600 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-orange-100">Awaiting Payment</span>)}</div><p className="text-gray-400 text-sm font-medium tracking-tight">Placed on {new Date(order.created_at).toLocaleString()}</p></div><div className="flex flex-col items-end gap-3"><span className="text-3xl font-black text-gray-900 tracking-tighter">${(order.total_price || 0).toFixed(2)}</span><div className="flex gap-2">{['pending', 'confirmed'].includes(order.status) && (<button onClick={(e) => handleCancelOrder(e, order.id)} className="text-[10px] font-black uppercase tracking-widest text-red-400 hover:text-red-600 border border-red-50 px-3 py-1.5 rounded-xl transition-all">Cancel Order</button>)}<span className="text-[10px] font-black uppercase tracking-widest text-gray-300 py-1.5">{expandedOrderId === order.id ? 'Close' : 'Details'}</span></div></div></div>
            <div className="relative pt-8 px-4"><div className="absolute top-11 left-10 right-10 h-1 bg-gray-100 rounded-full z-0"><div className="h-full bg-[#FF5C00] transition-all duration-1000 rounded-full" style={{ width: `${['pending', 'confirmed', 'preparing', 'ready', 'delivered'].indexOf(order.status) * 25}%` }}></div></div><div className="relative flex justify-between z-10">{['Pending', 'Confirmed', 'Preparing', 'Ready', 'Delivered'].map((step) => { const sL = step.toLowerCase(); const stages = ['pending', 'confirmed', 'preparing', 'ready', 'delivered']; const cI = stages.indexOf(order.status); const isComp = stages.indexOf(sL) <= cI; const isCurr = sL === order.status; return (<div key={step} className="flex flex-col items-center"><div className={`w-8 h-8 rounded-full flex items-center justify-center border-4 transition-all duration-500 ${isCurr ? 'bg-[#FF5C00] border-orange-200 animate-status-pulse scale-125 shadow-lg shadow-orange-100' : isComp ? 'bg-gray-900 border-white' : 'bg-white border-gray-100'}`}>{isComp && !isCurr && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7"></path></svg>}</div><span className={`mt-3 text-[10px] font-black uppercase tracking-widest ${isCurr ? 'text-[#FF5C00]' : isComp ? 'text-gray-900' : 'text-gray-200'}`}>{step}</span></div>); })}</div></div>
            {expandedOrderId === order.id && (<div className="mt-12 pt-10 border-t-2 border-dashed border-gray-100 animate-in fade-in slide-in-from-top-4 duration-500"><h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-6">Summary</h4><div className="space-y-4 mb-8">{order.items?.map(item => (<div key={item.item_id} className="flex justify-between items-center text-gray-900 font-bold"><span className="flex items-center gap-3"><span className="w-6 h-6 bg-gray-100 rounded flex items-center justify-center text-[10px] font-black">{item.quantity}x</span>{item.name}</span><span className="tracking-tighter">${(item.unit_price * item.quantity).toFixed(2)}</span></div>))}</div><div className="bg-gray-50 p-6 rounded-3xl"><p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Delivery Address</p><p className="text-gray-900 font-bold text-sm leading-relaxed">{order.delivery_address}</p></div></div>)}
          </div>
        ))}</div>
      )}
    </div>
  );
};

const MerchantPortal = ({ apiFetch, showAlert, showConfirm, addToast }) => {
  const [restaurant, setRestaurant] = useState(null); const [loading, setLoading] = useState(true); const [activeTab, setActiveTab] = useState(localStorage.getItem('merchantTab') || 'orders'); const [activeCount, setActiveCount] = useState(0);
  useEffect(() => { localStorage.setItem('merchantTab', activeTab); }, [activeTab]);
  const fetchMyRestaurant = useCallback(async () => { try { const data = await apiFetch('/api/restaurants/me'); if (data) setRestaurant(data); else setRestaurant(null); } catch (e) { if (e.message.includes('404') || e.message.includes('registered yet')) setRestaurant(null); else showAlert("System Error", e.message); } finally { setLoading(false); } }, [apiFetch, showAlert]);
  useEffect(() => { fetchMyRestaurant(); }, [fetchMyRestaurant]);
  const checkGlobalOrders = useCallback(async () => { try { if (!restaurant) return; const data = await apiFetch(`/api/orders/restaurant/${restaurant.id}`); if (Array.isArray(data)) { const count = data.filter(o => o.is_paid && o.status !== 'delivered' && o.status !== 'cancelled').length; setActiveCount(count); } } catch (e) { console.error(e); } }, [apiFetch, restaurant]);
  useEffect(() => { checkGlobalOrders(); const inv = setInterval(checkGlobalOrders, 10000); return () => clearInterval(inv); }, [checkGlobalOrders]);
  if (loading) return <PageLoader />;
  if (!restaurant) return <MerchantOnboarding apiFetch={apiFetch} onComplete={fetchMyRestaurant} showAlert={showAlert} />;
  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-end gap-6"><div><h2 className="text-4xl font-black text-gray-900 tracking-tight flex items-center gap-3">{restaurant.name}<span className={`text-[10px] px-3 py-1 rounded-full uppercase tracking-widest ${restaurant.is_open ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>{restaurant.is_open ? 'Live' : 'Closed'}</span></h2><p className="text-gray-400 font-medium tracking-tight">Merchant Portal • {restaurant.cuisine}</p></div><div className="flex bg-gray-100 p-1.5 rounded-2xl">
          <button onClick={() => setActiveTab('orders')} className={`px-6 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest transition-all relative ${activeTab === 'orders' ? 'bg-white text-[#FF5C00] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>Orders {activeCount > 0 && <span className="absolute -top-1 -right-1 bg-[#FF5C00] text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full border-2 border-white font-black">{activeCount}</span>}</button>
          <button onClick={() => setActiveTab('menu')} className={`px-6 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest transition-all ${activeTab === 'menu' ? 'bg-white text-[#FF5C00] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>Menu</button>
          <button onClick={() => setActiveTab('settings')} className={`px-6 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest transition-all ${activeTab === 'settings' ? 'bg-white text-[#FF5C00] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>Settings</button>
      </div></div>
      <div className="pt-4">{activeTab === 'orders' && <MerchantOrders apiFetch={apiFetch} restaurantId={restaurant.id} showConfirm={showConfirm} showAlert={showAlert} />}{activeTab === 'menu' && <MerchantMenuManager apiFetch={apiFetch} restaurant={restaurant} onUpdate={fetchMyRestaurant} showAlert={showAlert} showConfirm={showConfirm} addToast={addToast} />}{activeTab === 'settings' && <MerchantSettings apiFetch={apiFetch} restaurant={restaurant} onUpdate={fetchMyRestaurant} showAlert={showAlert} />}</div>
    </div>
  );
};

const MerchantOnboarding = ({ apiFetch, onComplete, showAlert }) => {
  const [form, setForm] = useState({ name: '', cuisine: '', address: '', slug: '', category: 'Trending' });
  const [submitting, setSubmitting] = useState(false);
  const handleSubmit = async (e) => { e.preventDefault(); setSubmitting(true); try { await apiFetch('/api/restaurants', { method: 'POST', body: JSON.stringify(form) }); onComplete(); } catch (e) { showAlert("Error", e.message); } finally { setSubmitting(false); } };
  return (
    <div className="max-w-2xl mx-auto"><div className="bg-white p-12 rounded-[3.5rem] shadow-2xl border border-gray-50 text-center"><span className="text-6xl mb-8 block font-black">🏪</span><h2 className="text-4xl font-black text-gray-900 tracking-tight mb-4 text-center">Launch Your Kitchen.</h2><p className="text-gray-400 font-medium mb-10 text-center text-sm">Join thousands of foodies.</p><form onSubmit={handleSubmit} className="space-y-6 text-left"><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div className="space-y-2"><label className="text-xs font-black uppercase tracking-widest text-gray-400 ml-2">Restaurant Name</label><input required className="w-full bg-gray-50 border-2 border-transparent focus:border-[#FF5C00] focus:bg-white rounded-2xl p-4 outline-none font-bold" placeholder="e.g. John's Pizza" value={form.name} onChange={e => { const val = e.target.value; const cS = val.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''); setForm({...form, name: val, slug: cS}); }} /></div><div className="space-y-2"><label className="text-xs font-black uppercase tracking-widest text-gray-400 ml-2">Cuisine Type</label><input required className="w-full bg-gray-50 border-2 border-transparent focus:border-[#FF5C00] focus:bg-white rounded-2xl p-4 outline-none font-bold" placeholder="e.g. Italian" value={form.cuisine} onChange={e => setForm({...form, cuisine: e.target.value})} /></div></div><div className="space-y-2"><label className="text-xs font-black uppercase tracking-widest text-gray-400 ml-2">Store Address</label><input required className="w-full bg-gray-50 border-2 border-transparent focus:border-[#FF5C00] focus:bg-white rounded-2xl p-4 outline-none font-bold" placeholder="Address" value={form.address} onChange={e => setForm({...form, address: e.target.value})} /></div><div className="space-y-2"><label className="text-xs font-black uppercase tracking-widest text-gray-400 ml-2">URL Slug</label><div className="relative"><span className="absolute left-4 top-4 text-gray-300 font-bold">foodbyte.app/</span><input required className="w-full bg-gray-50 border-2 border-transparent focus:border-[#FF5C00] focus:bg-white rounded-2xl p-4 pl-32 outline-none font-bold text-sm" placeholder="johns-pizza" value={form.slug} onChange={e => { const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''); setForm({...form, slug: val}); }} /></div></div><button type="submit" disabled={submitting} className="w-full bg-gray-900 text-white py-5 rounded-2xl font-black text-xl hover:bg-black transition-all transform hover:scale-[1.02] shadow-2xl mt-4 flex justify-center items-center gap-3">{submitting ? <Spinner /> : "Register Restaurant"}</button></form></div></div>
  );
};

const MerchantOrders = ({ apiFetch, restaurantId, showConfirm, showAlert, onActiveOrderChange }) => {
  const [orders, setOrders] = useState([]); const [loading, setLoading] = useState(true); const [expandedId, setExpandedId] = useState(null);
  const fetchOrders = useCallback(async () => { try { const data = await apiFetch(`/api/orders/restaurant/${restaurantId}`); if (data) { const paidOrders = Array.isArray(data) ? data.filter(o => o.is_paid) : []; setOrders(paidOrders); if (onActiveOrderChange) onActiveOrderChange(paidOrders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled').length); } } catch (e) { console.error(e); } finally { setLoading(false); } }, [apiFetch, restaurantId, onActiveOrderChange]);
  useEffect(() => { fetchOrders(); const inv = setInterval(fetchOrders, 10000); return () => clearInterval(inv); }, [fetchOrders]);
  const handleUpdateStatus = async (orderId, newStatus) => { try { await apiFetch(`/api/orders/${orderId}/status`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) }); fetchOrders(); } catch (e) { showAlert("Error", e.message); } };
  const onCancel = (e, orderId) => { e.stopPropagation(); showConfirm("Terminate Order", "Are you sure? Action is permanent.", () => handleUpdateStatus(orderId, 'cancelled')); };
  if (loading) return <PageLoader />;
  return (
    <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-gray-50/50"><h3 className="font-black text-xl text-gray-900 uppercase tracking-tight">Live Orders</h3><span className={`text-[10px] font-black bg-orange-100 text-[#FF5C00] px-3 py-1 rounded-full ${orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled').length > 0 ? 'animate-status-pulse' : ''}`}>{orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled').length} Active</span></div>
      {orders.length === 0 ? (<div className="p-20 text-center text-gray-300 font-bold uppercase tracking-tighter opacity-30">No orders yet.</div>) : (
        <div className="divide-y divide-gray-50">{orders.map(order => {
            const isExpanded = expandedId === order.id; const isCancelled = order.status === 'cancelled'; const isDelivered = order.status === 'delivered';
            const statusConfig = { pending: { c: 'bg-orange-400', l: 'New' }, confirmed: { c: 'bg-indigo-400', l: 'Confirmed' }, preparing: { c: 'bg-blue-400', l: 'In Kitchen' }, ready: { c: 'bg-green-500', l: 'Ready' }, delivered: { c: 'bg-gray-400', l: 'Done' }, cancelled: { c: 'bg-red-400', l: 'Void' } }[order.status] || { c: 'bg-gray-200', l: order.status };
            return (
              <div key={order.id} className={`transition-all ${isCancelled ? 'bg-red-50/20' : isExpanded ? 'bg-orange-50/5' : 'hover:bg-gray-50/50'}`}>
                <div onClick={() => setExpandedId(isExpanded ? null : order.id)} className="px-8 py-5 flex items-center justify-between cursor-pointer group"><div className="flex items-center gap-6"><div className={`w-3 h-3 rounded-full ${statusConfig.c} shadow-[0_0_10px_rgba(0,0,0,0.1)]`}></div><div><div className="flex items-center gap-3"><span className="font-black text-gray-900 text-sm uppercase">Order #{order.id.toString().substring(0,8)}</span><span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${isCancelled ? 'bg-red-100 text-red-500' : 'bg-gray-100 text-gray-500'}`}>{statusConfig.l}</span></div><p className="text-xs text-gray-400 font-medium mt-0.5 truncate max-w-[200px] sm:max-w-md">{order.delivery_address}</p></div></div><div className="flex items-center gap-8"><div className="text-right hidden sm:block"><p className="text-sm font-black text-gray-900 tracking-tighter">${(order.total_price || 0).toFixed(2)}</p><p className="text-[9px] font-bold text-gray-300 uppercase tracking-tighter">{new Date(order.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p></div><svg className={`w-5 h-5 text-gray-300 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"></path></svg></div></div>
                {isExpanded && (<div className="px-20 pb-10 pt-4 animate-in fade-in slide-in-from-top-2 duration-300"><div className="grid grid-cols-1 lg:grid-cols-2 gap-12"><div className="space-y-4"><h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">Summary</h4>{(order.items || []).map(i => (<div key={i.item_id} className="flex justify-between items-center py-1"><span className="text-sm font-bold text-gray-700 font-black"><span className="text-[#FF5C00] mr-2">{i.quantity}x</span> {i.name}</span><span className="text-sm font-black text-gray-400 tracking-tighter">${(i.unit_price * i.quantity).toFixed(2)}</span></div>))}</div><div className="bg-gray-50/50 p-8 rounded-3xl border border-gray-100"><div className="grid grid-cols-2 gap-3">
                          {[{ s: 'confirmed', l: 'Confirm', c: 'bg-orange-500' }, { s: 'preparing', l: 'Prepare', c: 'bg-indigo-500' }, { s: 'ready', l: 'Ready', c: 'bg-green-500' }, { s: 'delivered', l: 'Deliver', c: 'bg-gray-900' }].map(btn => { const currentIdx = ['pending', 'confirmed', 'preparing', 'ready', 'delivered'].indexOf(order.status); const btnIdx = ['pending', 'confirmed', 'preparing', 'ready', 'delivered'].indexOf(btn.s); const isPast = btnIdx <= currentIdx; return (<button key={btn.s} disabled={isPast || isCancelled} onClick={(e) => { e.stopPropagation(); handleUpdateStatus(order.id, btn.s); }} className={`py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${order.status === btn.s ? `${btn.c} text-white shadow-lg` : isPast || isCancelled ? 'bg-gray-100 text-gray-200 cursor-not-allowed' : 'bg-white text-gray-400 border border-gray-200 hover:border-[#FF5C00] hover:text-[#FF5C00] shadow-sm'}`}>{btn.l}</button>); })}
                          {!isDelivered && !isCancelled && (<button onClick={(e) => onCancel(e, order.id)} className="col-span-2 py-3 mt-4 rounded-xl text-[10px] font-black uppercase tracking-widest text-red-400 hover:bg-red-50 transition-all font-black">Void Order</button>)}
                          {isCancelled && <div className="col-span-2 py-4 text-center text-[10px] font-black uppercase tracking-widest text-red-500 bg-red-50 rounded-xl">Order Terminated</div>}
                  </div></div></div></div>)}
              </div>
            );
          })}</div>
      )}
    </div>
  );
};

const MerchantMenuManager = ({ apiFetch, restaurant, onUpdate, showAlert, showConfirm, addToast }) => {
  const [newItem, setNewItem] = useState({ name: '', description: '', price: '', category: 'main', is_available: true });
  const [editingId, setEditingId] = useState(null);
  const [adding, setAdding] = useState(false);

  const handleAddItem = async (e) => {
    e.preventDefault();
    setAdding(true);
    try {
      if (editingId) {
        await apiFetch(`/api/restaurants/${restaurant.id}/menu/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify({ ...newItem, price: parseFloat(newItem.price) })
        });
        addToast("Dish updated!");
      } else {
        await apiFetch(`/api/restaurants/${restaurant.id}/menu`, {
          method: 'POST',
          body: JSON.stringify({ ...newItem, price: parseFloat(newItem.price) })
        });
        addToast("Dish added!");
      }
      setNewItem({ name: '', description: '', price: '', category: 'main', is_available: true });
      setEditingId(null);
      onUpdate();
    } catch (e) { showAlert("Error", e.message); }
    finally { setAdding(false); }
  };

  const handleToggleVisibility = async (item) => {
    try {
      await apiFetch(`/api/restaurants/${restaurant.id}/menu/${item.item_id}`, {
        method: 'PATCH',
        body: JSON.stringify({ ...item, is_available: !item.is_available })
      });
      addToast(item.is_available ? "Dish hidden" : "Dish live");
      onUpdate();
    } catch (e) { showAlert("Error", e.message); }
  };

  const handleRemoveItem = (itemId) => {
    showConfirm("Delete Item", "Remove dish?", async () => {
      try {
        await apiFetch(`/api/restaurants/${restaurant.id}/menu/${itemId}`, { method: 'DELETE' });
        addToast("Removed");
        onUpdate();
      } catch (e) { showAlert("Error", e.message); }
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
      <div className="lg:col-span-1">
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-50 sticky top-28">
          <h3 className="text-xl font-black mb-6 tracking-tight uppercase">{editingId ? 'Edit Dish' : 'Add Item'}</h3>
          <form onSubmit={handleAddItem} className="space-y-4">
            <input required className="w-full bg-gray-50 border-transparent rounded-xl p-4 outline-none font-bold text-sm focus:bg-white focus:ring-2 focus:ring-orange-100 transition-all" placeholder="Name" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} />
            <textarea className="w-full bg-gray-50 border-transparent rounded-xl p-4 outline-none font-medium text-sm focus:bg-white focus:ring-2 focus:ring-orange-100 h-24 transition-all" placeholder="Description" value={newItem.description} onChange={e => setNewItem({...newItem, description: e.target.value})} />
            <div className="flex gap-3">
              <input required type="number" step="0.01" className="w-1/2 bg-gray-50 border-transparent rounded-xl p-4 outline-none font-bold text-sm focus:bg-white focus:ring-2 focus:ring-orange-100 transition-all" placeholder="Price" value={newItem.price} onChange={e => setNewItem({...newItem, price: e.target.value})} />
              <select className="w-1/2 bg-gray-50 border-transparent rounded-xl p-4 outline-none font-bold text-sm focus:bg-white focus:ring-2 focus:ring-orange-100 transition-all" value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})}><option value="main">Main</option><option value="side">Side</option><option value="drink">Drink</option><option value="dessert">Dessert</option></select>
            </div>
            <button type="submit" disabled={adding} className="w-full bg-[#FF5C00] text-white py-4 rounded-xl font-black text-sm uppercase tracking-widest hover:bg-[#E55200] shadow-lg disabled:opacity-50">{adding ? <Spinner /> : editingId ? "Update Item" : "Add to Menu"}</button>
            {editingId && <button type="button" onClick={() => { setEditingId(null); setNewItem({ name: '', description: '', price: '', category: 'main', is_available: true }); }} className="w-full text-[10px] font-black uppercase text-gray-400 mt-2">Cancel Edit</button>}
          </form>
        </div>
      </div>
      <div className="lg:col-span-2 space-y-6">
        <h3 className="text-xl font-black mb-2 tracking-tight uppercase">My Menu</h3>
        {restaurant.menu.length === 0 ? (
          <div className="bg-gray-50 p-20 rounded-[3rem] text-center border-2 border-dashed border-gray-200 text-gray-300 font-bold">Empty.</div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {restaurant.menu.map(item => (
              <div key={item.item_id} className={`bg-white p-6 rounded-3xl border border-gray-100 flex justify-between items-center group transition-all ${!item.is_available ? 'opacity-40 grayscale bg-gray-50/50' : 'hover:border-orange-200'}`}>
                <div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] bg-gray-100 text-gray-400 font-black px-2 py-0.5 rounded uppercase tracking-widest">{item.category}</span>
                    <h4 className="font-black text-lg text-gray-900">{item.name} {!item.is_available && '(Hidden)'}</h4>
                  </div>
                  <p className="text-xs text-gray-400 mt-1 max-w-md">{item.description}</p>
                </div>
                <div className="flex items-center gap-6">
                  <span className="font-black text-gray-900">${item.price.toFixed(2)}</span>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                    <button onClick={() => { setEditingId(item.item_id); setNewItem(item); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="p-2 text-gray-400 hover:text-indigo-500"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg></button>
                    <button onClick={() => handleToggleVisibility(item)} className={`p-2 ${item.is_available ? 'text-gray-400 hover:text-orange-500' : 'text-[#FF5C00]'}`}>{item.is_available ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg> : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"></path></svg>}</button>
                    <button onClick={() => handleRemoveItem(item.item_id)} className="p-2 text-gray-400 hover:text-red-500 transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
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

const MerchantSettings = ({ apiFetch, restaurant, onUpdate, showAlert }) => {
  const [statusLoading, setStatusLoading] = useState(false);
  const toggleStatus = async () => { setStatusLoading(true); try { await apiFetch(`/api/restaurants/${restaurant.id}`, { method: 'PATCH', body: JSON.stringify({ is_open: !restaurant.is_open }) }); onUpdate(); } catch (e) { showAlert("Error", e.message); } finally { setStatusLoading(false); } };
  return (
    <div className="max-w-2xl mx-auto space-y-12"><div className="bg-white p-10 rounded-[3rem] shadow-sm border border-gray-50"><h3 className="text-xl font-black mb-6 tracking-tight uppercase text-gray-900">Operational Status</h3><div className={`p-8 rounded-[2rem] border-2 flex items-center justify-between transition-all ${restaurant.is_open ? 'border-green-100 bg-green-50/20' : 'border-gray-100 bg-gray-50/50'}`}><div><p className={`font-black uppercase tracking-widest text-xs ${restaurant.is_open ? 'text-green-600' : 'text-gray-400'}`}>{restaurant.is_open ? 'Accepting Orders' : 'Kitchen Closed'}</p><p className="text-sm text-gray-400 font-medium mt-1">Control visibility.</p></div><button onClick={toggleStatus} disabled={statusLoading} className={`w-16 h-8 rounded-full relative transition-all ${restaurant.is_open ? 'bg-green-500' : 'bg-gray-300'}`}><div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-all ${restaurant.is_open ? 'left-9' : 'left-1'}`}></div></button></div></div><div className="bg-white p-10 rounded-[3rem] shadow-sm border border-gray-50 opacity-40"><h3 className="text-xl font-black mb-6 tracking-tight uppercase">Business Details</h3><p className="text-sm text-gray-400">Locked.</p></div></div>
  );
};

const Login = ({ onLogin, onSwitch, apiFetch }) => {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [err, setErr] = useState(''); const [loading, setLoading] = useState(false);
  const handleSubmit = async (e) => { e.preventDefault(); setErr(''); setLoading(true); try { const data = await apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }); if (data) onLogin(data.access_token, data.user); } catch (e) { setErr(e.message); } finally { setLoading(false); } };
  return (
    <div className="max-w-md mx-auto mt-16 bg-white rounded-[2.5rem] shadow-2xl p-12 border border-gray-50 text-center"><h2 className="text-3xl font-black mb-8 text-gray-900 tracking-tight uppercase">Login</h2><form onSubmit={handleSubmit} className="space-y-6 text-left"><div><label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Email</label><input type="email" required className="w-full bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-orange-200 font-bold transition-all" value={email} onChange={e => setEmail(e.target.value)} /></div><div><label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Password</label><input type="password" required className="w-full bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-orange-200 font-bold transition-all" value={password} onChange={e => setPassword(e.target.value)} /></div>{err && <p className="text-red-500 text-[10px] font-black text-center uppercase tracking-widest">{err}</p>}<button disabled={loading} type="submit" className="w-full bg-gray-900 text-white p-4 rounded-2xl hover:bg-black transition font-black flex justify-center shadow-xl">{loading ? <Spinner /> : 'Login'}</button></form><p className="mt-8 text-center text-xs font-bold text-gray-400 uppercase tracking-widest">New? <button onClick={onSwitch} className="text-[#FF5C00] font-black">Register</button></p></div>
  );
};

const Register = ({ onRegister, onSwitch, apiFetch }) => {
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [role, setRole] = useState('customer'); const [err, setErr] = useState(''); const [loading, setLoading] = useState(false);
  const handleSubmit = async (e) => { e.preventDefault(); setErr(''); setLoading(true); try { const data = await apiFetch('/api/auth/register', { method: 'POST', body: JSON.stringify({ email, name, password, role }) }); if (data) onRegister(data.access_token, data.user); } catch (e) { setErr(e.message); } finally { setLoading(false); } };
  return (
    <div className="max-w-md mx-auto mt-16 bg-white rounded-[2.5rem] shadow-2xl p-12 border border-gray-50 text-center"><h2 className="text-3xl font-black mb-8 text-gray-900 tracking-tight uppercase">Register</h2><form onSubmit={handleSubmit} className="space-y-6 text-left"><div><label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Full Name</label><input type="text" required className="w-full bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-orange-200 font-bold transition-all" value={name} onChange={e => setName(e.target.value)} /></div><div><label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Email</label><input type="email" required className="w-full bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-orange-200 font-bold transition-all" value={email} onChange={e => setEmail(e.target.value)} /></div><div><label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Password</label><input type="password" required className="w-full bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-orange-200 font-bold transition-all" value={password} onChange={e => setPassword(e.target.value)} /></div><div><label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Account Type</label><select className="w-full bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-orange-200 font-black uppercase text-xs transition-all" value={role} onChange={e => setRole(e.target.value)}><option value="customer">Customer</option><option value="restaurant">Restaurant Owner</option></select></div>{err && <p className="text-red-500 text-[10px] font-black text-center uppercase tracking-widest">{err}</p>}<button disabled={loading} type="submit" className="w-full bg-gray-900 text-white p-4 rounded-2xl hover:bg-black transition font-black flex justify-center shadow-xl">{loading ? <Spinner /> : 'Register'}</button></form><p className="mt-8 text-center text-xs font-bold text-gray-400 uppercase tracking-widest">Existing? <button onClick={onSwitch} className="text-[#FF5C00] font-black">Login</button></p></div>
  );
};

const Footer = () => (<footer className="bg-white border-t border-gray-100 py-16"><div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center opacity-60"><div className="flex items-center space-x-2 mb-4 md:mb-0 font-extrabold text-2xl text-gray-900">FoodByte</div><div className="flex space-x-6 text-[10px] font-black uppercase tracking-widest text-gray-400"><button>Privacy</button><button>Terms</button><button>Help</button></div></div></footer>);
const Spinner = () => (<svg className="animate-spin h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>);
