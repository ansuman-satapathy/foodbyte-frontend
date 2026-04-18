import React, { useState, useEffect, useCallback } from 'react';

// Hero image URL - Using high-quality public asset for modern food delivery aesthetic
const HERO_IMAGE = "https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=2070&auto=format&fit=crop";

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [user, setUser] = useState(null);
  const [currentView, setCurrentView] = useState(localStorage.getItem('currentView') || 'landing');

  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [cart, setCart] = useState({ restaurant_id: null, items: [] });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);

  const apiFetch = useCallback(async (path, options = {}) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    // Ensure we use the current host+port for relative paths to avoid port-stripping errors
    const baseUrl = window.location.origin;
    const fullPath = path.startsWith('http') ? path : `${baseUrl}${path}`;
    
    const response = await fetch(fullPath, {
      ...options,
      headers: { ...headers, ...options.headers },
    });

    const contentType = response.headers.get("content-type");
    let data;
    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
    } else {
      const text = await response.text();
      data = text ? { detail: text } : {};
    }

    if (!response.ok) {
      const errorDetail = data && data.detail ? (typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail)) : 'API Error';
      throw new Error(errorDetail);
    }
    return data;
  }, [token]);

  useEffect(() => {
    const initAuth = async () => {
      if (token) {
        try {
          const userData = await apiFetch('/api/users/me');
          setUser(userData);
          // If on landing pages while logged in, redirect correctly
          if (currentView === 'landing' || currentView === 'login' || currentView === 'register') {
            setCurrentView(userData.role === 'restaurant' ? 'admin' : 'home');
          }
        } catch {
          setToken(null);
          localStorage.removeItem('token');
          setCurrentView('landing');
        }
      }
      setLoading(false);
    };
    initAuth();
  }, [token, apiFetch, currentView]);

  // Role Guard: Prevent owners from browsing and customers from admin views
  useEffect(() => {
    let nextView = currentView;
    if (user) {
      if (user.role === 'restaurant' && (currentView === 'home' || currentView === 'restaurant' || currentView === 'checkout')) {
        nextView = 'admin';
      } else if (user.role === 'customer' && currentView === 'admin') {
        nextView = 'home';
      }
    }
    
    if (nextView !== currentView) {
      setTimeout(() => setCurrentView(nextView), 0);
    }
  }, [user, currentView]);
 
   useEffect(() => {
     localStorage.setItem('currentView', currentView);
   }, [currentView]);

  const handleLoggedOut = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('currentView');
    setCurrentView('landing');
  };

  if (loading) return <PageLoader />;

  return (
    <div className="min-h-screen bg-[#FDFCFB] flex flex-col font-sans text-gray-900 overflow-x-hidden">
      {/* Navigation */}
      <NavBar 
        user={user} 
        onNavigate={setCurrentView} 
        onLogout={handleLoggedOut} 
        currentView={currentView}
        cartCount={cart.items.reduce((sum, i) => sum + i.quantity, 0)}
      />

      <main className="flex-1">
        {currentView === 'landing' && <LandingView onStart={() => setCurrentView(user?.role === 'restaurant' ? 'admin' : 'home')} />}
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {currentView === 'login' && (
            <Login
              onLogin={(t, u) => { 
                console.log("Login success. User role:", u.role);
                setToken(t); 
                localStorage.setItem('token', t); 
                setUser(u); 
                setCurrentView(u.role === 'restaurant' ? 'admin' : 'home'); 
              }}
              onSwitch={() => setCurrentView('register')}
              apiFetch={apiFetch}
            />
          )}
          {currentView === 'register' && (
            <Register
              onRegister={(t, u) => { 
                console.log("Register success. User role:", u.role);
                setToken(t); 
                localStorage.setItem('token', t); 
                setUser(u); 
                setCurrentView(u.role === 'restaurant' ? 'admin' : 'home'); 
              }}
              onSwitch={() => setCurrentView('login')}
              apiFetch={apiFetch}
            />
          )}
          {currentView === 'home' && (
            <Home 
              apiFetch={apiFetch} 
              onSelect={(r) => { setSelectedRestaurant(r); setCurrentView('restaurant'); }} 
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
            />
          )}
          {currentView === 'restaurant' && (
            <RestaurantView
              apiFetch={apiFetch}
              restaurant={selectedRestaurant}
              cart={cart}
              setCart={setCart}
              onCheckout={() => setCurrentView('checkout')}
              onBack={() => setCurrentView('home')}
            />
          )}
          {currentView === 'checkout' && (
            <CheckoutView 
              apiFetch={apiFetch} 
              cart={cart} 
              setCart={setCart}
              onOrderPlaced={() => setCurrentView('orders')} 
            />
          )}
          {currentView === 'orders' && <OrdersView apiFetch={apiFetch} />}
          {currentView === 'admin' && <MerchantPortal apiFetch={apiFetch} user={user} />}
        </div>
      </main>
      
      <Footer />
    </div>
  );
}

// ── LANDING VIEW ─────────────────────────────────────────────────────────────

const LandingView = ({ onStart }) => (
  <div className="relative overflow-hidden bg-gray-900 text-white">
    <div className="absolute inset-0 z-0 opactiy-60">
      <img src={HERO_IMAGE} alt="Hero" className="w-full h-full object-cover brightness-[0.4]" />
    </div>
    <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 flex flex-col items-center text-center">
      <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6">
        Gourmet Meals,<br/><span className="text-[#FF5C00]">Delivered to You.</span>
      </h1>
      <p className="text-xl md:text-2xl text-gray-300 max-w-2xl mb-10 leading-relaxed">
        Experience the finest local restaurants from the comfort of your home. 
        Fresh, hot, and fast delivery guaranteed.
      </p>
      <button 
        onClick={onStart}
        className="bg-[#FF5C00] hover:bg-[#E55200] text-white px-10 py-5 rounded-full text-xl font-bold transition-all transform hover:scale-105 shadow-2xl"
      >
        Start Your Order
      </button>
      
      <div className="mt-20 grid grid-cols-2 lg:grid-cols-4 gap-8 w-full max-w-4xl text-sm font-medium">
        <div className="flex flex-col items-center"><span className="text-3xl mb-2">🚀</span> Fast Delivery</div>
        <div className="flex flex-col items-center"><span className="text-3xl mb-2">🍕</span> Top Cuisines</div>
        <div className="flex flex-col items-center"><span className="text-3xl mb-2">⭐</span> Premium Quality</div>
        <div className="flex flex-col items-center"><span className="text-3xl mb-2">📍</span> Real-time Tracking</div>
      </div>
    </div>
  </div>
);

// ── NAVIGATION ───────────────────────────────────────────────────────────────

const NavBar = ({ user, currentView, onNavigate, onLogout, cartCount }) => (
  <nav className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-gray-100">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex justify-between h-20">
        <div className="flex items-center space-x-8">
          <button onClick={() => onNavigate('landing')} className="flex items-center space-x-2">
            <span className="bg-[#FF5C00] text-white w-10 h-10 flex items-center justify-center rounded-lg font-black text-2xl shadow-lg shadow-orange-100">F</span>
            <span className="text-2xl font-black tracking-tighter text-gray-900">FoodByte</span>
          </button>
          
          <div className="hidden lg:flex items-center space-x-6 text-sm font-bold text-gray-500 uppercase tracking-widest">
            {user?.role !== 'restaurant' && <button onClick={() => onNavigate('home')} className={currentView === 'home' ? 'text-[#FF5C00]' : 'hover:text-gray-900'}>Browse</button>}
            {user?.role !== 'restaurant' && (
               <button onClick={() => onNavigate('orders')} className={currentView === 'orders' ? 'text-[#FF5C00]' : 'hover:text-gray-900'}>History</button>
            )}
            {user?.role === 'restaurant' && (
               <button onClick={() => onNavigate('admin')} className={currentView === 'admin' ? 'text-[#FF5C00]' : 'hover:text-gray-900'}>Merchant Portal</button>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          {user ? (
            <div className="flex items-center space-x-4">
              {user.role !== 'restaurant' && (
                <button onClick={() => onNavigate('orders')} className="relative p-2 text-gray-400 hover:text-[#FF5C00]">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>
                  {cartCount > 0 && <span className="absolute overflow-hidden -top-1 -right-1 bg-[#FF5C00] text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full font-bold ring-2 ring-white">{cartCount}</span>}
                </button>
              )}
              <div className="h-10 border-l border-gray-200 mx-2 hidden sm:block"></div>
              <div className="flex flex-col items-end hidden sm:flex">
                <span className="text-sm font-black text-gray-900">{user.name}</span>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter opacity-70">{user.role}</span>
              </div>
              <button onClick={onLogout} className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-5 py-2 rounded-full text-sm font-bold transition-all">
                Sign Out
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-3">
              <button onClick={() => onNavigate('login')} className="text-gray-600 px-6 py-2 text-sm font-bold">Login</button>
              <button onClick={() => onNavigate('register')} className="bg-[#FF5C00] hover:bg-[#E55200] text-white px-6 py-2 rounded-full text-sm font-bold shadow-lg shadow-orange-100">Sign Up</button>
            </div>
          )}
        </div>
      </div>
    </div>
  </nav>
);

// ── DISCOVERY (HOME) VIEW ────────────────────────────────────────────────────

const Home = ({ apiFetch, onSelect, searchQuery, setSearchQuery, selectedCategory, setSelectedCategory }) => {
  const [restaurants, setRestaurants] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [resData, catData] = await Promise.all([
          apiFetch('/api/restaurants'),
          apiFetch('/api/restaurants/categories')
        ]);
        setRestaurants(resData);
        setCategories(catData);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, [apiFetch]);

  const filtered = restaurants.filter(r => {
    const matchesSearch = !searchQuery || r.name.toLowerCase().includes(searchQuery.toLowerCase()) || r.cuisine.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = !selectedCategory || r.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-10">
      {/* Search & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-gray-900 tracking-tight">Browse Kitchens.</h2>
          <p className="text-gray-400 font-medium mt-1">Order from {restaurants.length}+ local favorites.</p>
        </div>
        
        <div className="relative group w-full md:w-96">
          <input 
            type="text" 
            placeholder="Search kitchens, cuisines..." 
            className="w-full bg-white border-2 border-gray-100 focus:border-[#FF5C00] rounded-2xl p-4 pl-12 shadow-sm transition-all focus:shadow-xl focus:shadow-orange-50 outline-none font-medium"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          <svg className="w-5 h-5 text-gray-300 absolute left-4 top-5 group-focus-within:text-[#FF5C00] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
        </div>
      </div>

      {/* Category Chips */}
      <div className="flex items-center space-x-3 overflow-x-auto pb-4 -mx-4 px-4 no-scrollbar">
        <button 
          onClick={() => setSelectedCategory(null)}
          className={`flex-shrink-0 px-6 py-2.5 rounded-full text-sm font-bold transition-all ${!selectedCategory ? 'bg-[#FF5C00] text-white shadow-lg shadow-orange-100' : 'bg-white text-gray-500 border border-gray-100 hover:border-gray-200'}`}
        >
          All Kitchens
        </button>
        {categories.map(cat => (
          <button 
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`flex-shrink-0 px-6 py-2.5 rounded-full text-sm font-bold transition-all ${selectedCategory === cat ? 'bg-[#FF5C00] text-white shadow-lg shadow-orange-100' : 'bg-white text-gray-500 border border-gray-100 hover:border-gray-200'}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Restaurant Grid */}
      {filtered.length === 0 ? (
        <div className="bg-white p-20 rounded-3xl text-center border-2 border-dashed border-gray-100">
          <span className="text-6xl mb-6 block">🍽️</span>
          <h3 className="text-xl font-bold text-gray-800">
            {searchQuery || selectedCategory ? "No restaurants match your filter" : "Our kitchens are busy preparing something special."}
          </h3>
          {(searchQuery || selectedCategory) && (
            <button onClick={() => {setSearchQuery(''); setSelectedCategory(null);}} className="text-[#FF5C00] font-bold mt-2 hover:underline">Clear all filters</button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {filtered.map(r => (
            <div 
              key={r.id} 
              onClick={() => onSelect(r)} 
              className="bg-white rounded-[2.5rem] shadow-sm hover:shadow-2xl transition-all cursor-pointer overflow-hidden group border border-gray-50 flex flex-col h-full transform hover:-translate-y-2 duration-500"
            >
              <div className="h-64 relative overflow-hidden">
                <img src={r.image_url} alt={r.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 brightness-90" />
                <div className="absolute top-6 left-6 flex space-x-2">
                  <span className="bg-white/90 backdrop-blur-md text-gray-900 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-sm">
                    {r.cuisine}
                  </span>
                </div>
                {!r.is_open && (
                  <div className="absolute inset-0 bg-gray-900/60 flex items-center justify-center">
                    <span className="bg-white text-gray-900 font-black px-6 py-2 rounded-full uppercase tracking-tighter shadow-xl">Currently Closed</span>
                  </div>
                )}
              </div>
              <div className="p-8 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-2xl font-black text-gray-900 group-hover:text-[#FF5C00] transition-colors">{r.name}</h3>
                  <div className="flex items-center text-yellow-400">
                    <span className="font-black text-sm mr-1">4.8</span>
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>
                  </div>
                </div>
                <div className="flex items-center text-gray-400 text-sm font-medium space-x-3 mt-1">
                   <span>30-45 min</span>
                   <span className="w-1 h-1 bg-gray-200 rounded-full"></span>
                   <span>$2.99 Delivery</span>
                </div>
                <p className="text-sm text-gray-400 mt-6 leading-relaxed flex items-start">
                  <svg className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path></svg>
                  {r.address}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── RESTAURANT (MENU) VIEW ───────────────────────────────────────────────────

const RestaurantView = ({ apiFetch, restaurant, cart, setCart, onCheckout, onBack }) => {
  const [fullRestaurant, setFullRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const data = await apiFetch(`/api/restaurants/${restaurant.id}`);
        setFullRestaurant(data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    if (restaurant) fetch();
  }, [restaurant, apiFetch]);

  const addToCart = (item) => {
    setCart(prev => {
      if (prev.restaurant_id !== restaurant.id) {
        return { restaurant_id: restaurant.id, items: [{ ...item, quantity: 1 }] };
      }
      const existing = prev.items.find(i => i.item_id === item.item_id);
      if (existing) {
        return {
          ...prev,
          items: prev.items.map(i => i.item_id === item.item_id ? { ...i, quantity: i.quantity + 1 } : i)
        };
      }
      return { ...prev, items: [...prev.items, { ...item, quantity: 1 }] };
    });
  };

  const removeFromCart = (itemId) => {
    setCart(prev => ({
      ...prev,
      items: prev.items.map(i => i.item_id === itemId ? { ...i, quantity: i.quantity - 1 } : i).filter(i => i.quantity > 0)
    }));
  };

  if (loading) return <PageLoader />;
  if (!fullRestaurant) return null;

  const cartTotal = cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <div className="flex flex-col lg:flex-row gap-12">
      {/* Menu Area */}
      <div className="flex-1 space-y-8">
        <button onClick={onBack} className="flex items-center text-gray-400 hover:text-gray-900 font-bold group transition-colors">
          <svg className="w-5 h-5 mr-2 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
          Back to Kitchens
        </button>

        <div className="relative h-96 rounded-[3rem] overflow-hidden shadow-2xl">
          <img src={fullRestaurant.image_url} alt={fullRestaurant.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/40 to-transparent p-12 flex flex-col justify-end">
            <h1 className="text-6xl font-black text-white tracking-tighter mb-4">{fullRestaurant.name}</h1>
            <div className="flex items-center space-x-6 text-sm">
              <span className="bg-[#FF5C00] text-white px-4 py-1.5 rounded-full font-black uppercase tracking-widest">{fullRestaurant.cuisine}</span>
              <span className="text-gray-300 font-bold flex items-center">
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                Open until 11:00 PM
              </span>
            </div>
          </div>
        </div>

        {/* Menu Items */}
        <div className="space-y-12 pt-10">
          <h2 className="text-3xl font-black text-gray-900 border-b-4 border-gray-100 pb-4 inline-block">Crafted Menu.</h2>
          {fullRestaurant.menu.length === 0 ? (
            <p className="text-gray-400 font-medium">No items added to this kitchen yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {fullRestaurant.menu.map(item => (
                <div key={item.item_id} className="bg-white border border-gray-100 p-8 rounded-[2rem] flex justify-between items-center group hover:border-[#FF5C00] transition-colors shadow-sm">
                  <div className="flex-1 pr-6">
                    <h4 className="text-xl font-black text-gray-900 mb-2">{item.name}</h4>
                    <p className="text-sm text-gray-400 font-medium leading-relaxed">{item.description}</p>
                    <p className="text-[#FF5C00] font-black text-xl mt-4">${item.price.toFixed(2)}</p>
                  </div>
                  <button 
                    onClick={() => addToCart(item)}
                    className="w-14 h-14 rounded-2xl bg-gray-50 group-hover:bg-[#FF5C00] group-hover:text-white text-gray-300 flex items-center justify-center transition-all shadow-sm"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cart Sidebar */}
      <div className="w-full lg:w-[400px] flex-shrink-0">
        <div className="bg-white rounded-[3rem] shadow-2xl border border-gray-100 p-10 lg:sticky lg:top-28">
          <h3 className="text-2xl font-black text-gray-900 mb-8 flex items-center">
            My Tray
            {cart.items.length > 0 && <span className="ml-3 bg-gray-100 text-gray-500 rounded-full w-8 h-8 flex items-center justify-center text-xs">{cart.items.length}</span>}
          </h3>
          
          {cart.items.length === 0 ? (
            <div className="py-20 text-center text-gray-300 space-y-4">
              <span className="text-5xl block opacity-30">🚲</span>
              <p className="font-bold text-gray-400">Empty tray, empty stomach.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2 custom-scroll">
                {cart.items.map(item => (
                  <div key={item.item_id} className="flex justify-between items-center group">
                    <div className="flex-1 pr-4">
                      <p className="font-black text-gray-900">{item.name}</p>
                      <p className="text-xs font-bold text-[#FF5C00] opacity-80">${item.price.toFixed(2)}</p>
                    </div>
                    <div className="flex items-center space-x-3 bg-gray-50 rounded-xl p-1.5 border border-gray-100">
                      <button onClick={() => removeFromCart(item.item_id)} className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-500 font-black">-</button>
                      <span className="w-4 text-center font-black text-sm">{item.quantity}</span>
                      <button onClick={() => addToCart(item)} className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-[#FF5C00] font-black">+</button>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="border-t-2 border-dashed border-gray-100 pt-8 space-y-4">
                <div className="flex justify-between text-gray-400 font-bold uppercase tracking-widest text-[10px]">
                  <span>Subtotal</span>
                  <span>${cartTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-400 font-bold uppercase tracking-widest text-[10px]">
                  <span>Delivery Fee</span>
                  <span>$2.99</span>
                </div>
                <div className="flex justify-between text-2xl font-black text-gray-900 pt-2">
                  <span>Total</span>
                  <span className="text-[#FF5C00]">${(cartTotal + 2.99).toFixed(2)}</span>
                </div>
              </div>

              <button 
                onClick={onCheckout}
                className="w-full bg-[#FF5C00] hover:bg-[#E55200] text-white py-5 rounded-2xl font-black text-lg transition-all transform hover:scale-[1.02] shadow-xl shadow-orange-100 mt-6"
              >
                Continue to Checkout
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── CHECKOUT VIEW ────────────────────────────────────────────────────────────

const CheckoutView = ({ apiFetch, cart, setCart, onOrderPlaced }) => {
  const [addresses, setAddresses] = useState([]);
  const [selectedAddr, setSelectedAddr] = useState(null);
  const [newAddr, setNewAddr] = useState({ label: 'Home', address: '' });
  const [isPaying, setIsPaying] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await apiFetch('/api/users/me/addresses');
        setAddresses(data);
        const def = data.find(a => a.is_default) || data[0];
        if (def) setSelectedAddr(def.id);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, [apiFetch]);

  const handleAddAddr = async (e) => {
    e.preventDefault();
    if (!newAddr.address.trim()) return;
    try {
      const added = await apiFetch('/api/users/me/addresses', {
        method: 'POST',
        body: JSON.stringify(newAddr)
      });
      setAddresses([added, ...addresses]);
      setSelectedAddr(added.id);
      setNewAddr({ label: 'Home', address: '' });
    } catch (e) { alert(e.message); }
  };

  const handlePlaceOrder = async () => {
    if (!selectedAddr) return alert("Please select a delivery address.");
    setIsPaying(true);
    try {
      const addr = addresses.find(a => a.id === selectedAddr);
      const order = await apiFetch('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          restaurant_id: cart.restaurant_id,
          items: cart.items.map(i => ({ item_id: i.item_id, quantity: i.quantity })),
          delivery_address: addr.address
        })
      });
      
      // Simulated Payment Flow
      await apiFetch(`/api/orders/${order.id}/pay`, { method: 'POST' });
      
      setCart({ restaurant_id: null, items: [] });
      onOrderPlaced();
    } catch (e) { alert(e.message); }
    finally { setIsPaying(false); }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="max-w-3xl mx-auto space-y-12">
      <h2 className="text-4xl font-black text-gray-900 tracking-tight text-center">Checkout.</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <div className="space-y-8">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
            <h3 className="text-xl font-black mb-6 flex items-center">
              <span className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center mr-3 text-sm">1</span>
              Delivery Location
            </h3>
            
            <div className="space-y-4">
              {addresses.map(a => (
                <div 
                  key={a.id} 
                  onClick={() => setSelectedAddr(a.id)}
                  className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${selectedAddr === a.id ? 'border-[#FF5C00] bg-orange-50/10' : 'border-gray-100 hover:border-gray-200'}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-black text-sm uppercase tracking-wider">{a.label}</span>
                    {a.is_default && <span className="text-[10px] bg-gray-100 text-gray-400 px-2 py-0.5 rounded font-black uppercase">Default</span>}
                  </div>
                  <p className="text-sm text-gray-400 font-medium">{a.address}</p>
                </div>
              ))}
              
              <form onSubmit={handleAddAddr} className="pt-4 border-t border-gray-100 border-dashed">
                <input 
                  type="text" 
                  placeholder="Street name, house number..." 
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-sm mb-3 outline-none focus:ring-1 focus:ring-orange-200"
                  value={newAddr.address}
                  onChange={e => setNewAddr({...newAddr, address: e.target.value})}
                />
                <button className="text-sm font-bold text-[#FF5C00] hover:underline">+ Add New Address</button>
              </form>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
            <h3 className="text-xl font-black mb-6 flex items-center">
              <span className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center mr-3 text-sm">2</span>
              Payment Method
            </h3>
            <div className="p-5 rounded-2xl border-2 border-gray-100 bg-gray-50/40 opacity-50 flex items-center space-x-4">
              <div className="w-12 h-12 bg-gray-200 rounded-xl"></div>
              <div className="flex-1">
                <p className="font-black text-sm">Stored Balance</p>
                <p className="text-xs font-bold text-gray-400">Available: $0.00</p>
              </div>
            </div>
            <div className="mt-4 p-5 rounded-2xl border-2 border-[#FF5C00] bg-orange-50/10 flex items-center space-x-4">
              <div className="w-12 h-12 bg-[#FF5C00]/10 text-[#FF5C00] flex items-center justify-center rounded-xl font-black text-xs">P.P</div>
              <div className="flex-1">
                <p className="font-black text-sm text-[#FF5C00]">Point to Point Payment</p>
                <p className="text-xs font-bold text-orange-400">Direct debit simulated</p>
              </div>
            </div>
          </div>

          <button 
            disabled={isPaying || !selectedAddr}
            onClick={handlePlaceOrder}
            className="w-full bg-gray-900 text-white py-6 rounded-[2rem] font-black text-xl hover:bg-black transition-all transform hover:scale-[1.02] shadow-2xl flex justify-center items-center gap-3 disabled:opacity-50 disabled:transform-none"
          >
            {isPaying ? <Spinner /> : <><span className="text-2xl">⚡</span> Confirm & Pay</>}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── ORDERS VIEW (TRACKING) ───────────────────────────────────────────────────

const OrdersView = ({ apiFetch }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    try {
      const data = await apiFetch('/api/orders');
      setOrders(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [apiFetch]);

  const handleCancelOrder = async (orderId) => {
    if (!confirm("Are you sure you want to cancel this order?")) return;
    try {
      await apiFetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'cancelled' })
      });
      fetchOrders();
    } catch (e) { alert(e.message); }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  if (loading) return <PageLoader />;

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-20">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-black text-gray-900 tracking-tight">Track Your Journey.</h2>
          <p className="text-gray-400 font-medium">Real-time status of your gourmet meal.</p>
        </div>
        <button onClick={fetchOrders} className="text-[#FF5C00] hover:bg-orange-50 px-4 py-2 rounded-xl text-sm font-black uppercase tracking-wider transition-colors">Refresh</button>
      </div>

      {orders.length === 0 ? (
        <div className="bg-white p-20 rounded-[3rem] text-center border-2 border-dashed border-gray-100">
           <span className="text-6xl mb-6 block">🥡</span>
           <p className="font-bold text-gray-400">Empty history. Hungry for something?</p>
        </div>
      ) : (
        <div className="space-y-8">
          {orders.map(order => (
            <div key={order.id} className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-gray-50 group hover:shadow-2xl transition-all duration-500">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div>
                  <div className="flex items-center space-x-4 mb-2">
                    <span className="font-black text-2xl text-gray-900 group-hover:text-[#FF5C00] transition-colors">Order #{order.id.toString().substring(0,8)}</span>
                    {order.is_paid && <span className="bg-green-50 text-green-600 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-green-100">Paid</span>}
                  </div>
                  <p className="text-gray-400 text-sm font-medium">Placed on {new Date(order.created_at).toLocaleString()}</p>
                </div>
                <div className="flex md:flex-col md:items-end gap-2">
                  <span className="text-3xl font-black text-gray-900">${(order.total_price || 0).toFixed(2)}</span>
                  {(order.status === 'pending' || order.status === 'confirmed') && (
                    <button 
                      onClick={() => handleCancelOrder(order.id)}
                      className="text-[10px] font-black uppercase tracking-widest text-red-400 hover:text-red-600 border border-red-50 px-3 py-1.5 rounded-xl transition-all hover:bg-red-50 mt-2"
                    >
                      Cancel Order
                    </button>
                  )}
                </div>
              </div>

              {/* Status Stepper */}
              {order.status === 'cancelled' ? (
                <div className="bg-red-50 border border-red-100 p-6 rounded-3xl flex items-center justify-between">
                  <div>
                    <p className="text-red-600 font-black text-xl tracking-tight">Order Cancelled.</p>
                    <p className="text-red-400 text-sm font-bold">This request has been terminated.</p>
                  </div>
                  <span className="text-4xl">🛑</span>
                </div>
              ) : (
                <div className="relative pt-8 px-4">
                  <div className="absolute top-11 left-10 right-10 h-1 bg-gray-100 rounded-full z-0">
                    <div 
                      className="h-full bg-[#FF5C00] transition-all duration-1000 rounded-full" 
                      style={{ width: `${['pending', 'confirmed', 'preparing', 'ready', 'delivered'].indexOf(order.status) * 25}%` }}
                    ></div>
                  </div>
                  <div className="relative flex justify-between z-10">
                    {['Pending', 'Confirmed', 'Preparing', 'Ready', 'Delivered'].map((step) => {
                      const stepLower = step.toLowerCase();
                      const stages = ['pending', 'confirmed', 'preparing', 'ready', 'delivered'];
                      const currentIdx = stages.indexOf(order.status);
                      const isCompleted = stages.indexOf(stepLower) <= currentIdx;
                      const isCurrent = stepLower === order.status;
                      
                      return (
                        <div key={step} className="flex flex-col items-center">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-4 transition-all duration-500 ${isCurrent ? 'bg-[#FF5C00] border-orange-200 scale-125 shadow-lg shadow-orange-100' : isCompleted ? 'bg-gray-900 border-white' : 'bg-white border-gray-100'}`}>
                            {isCompleted && !isCurrent && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7"></path></svg>}
                          </div>
                          <span className={`mt-3 text-[10px] font-black uppercase tracking-widest ${isCurrent ? 'text-[#FF5C00]' : isCompleted ? 'text-gray-900' : 'text-gray-200'}`}>{step}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── MERCHANT PORTAL (OWNER EXPERIENCE) ──────────────────────────────────────

const MerchantPortal = ({ apiFetch }) => {
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('orders'); // 'orders', 'menu', 'settings'

  const fetchMyRestaurant = useCallback(async () => {
    try {
      const data = await apiFetch('/api/restaurants/me');
      setRestaurant(data);
    } catch (e) {
      if (e.message.includes('404')) setRestaurant(null);
      else console.error(e);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    fetchMyRestaurant();
  }, [fetchMyRestaurant]);

  if (loading) return <PageLoader />;

  if (!restaurant) {
    return <MerchantOnboarding apiFetch={apiFetch} onComplete={fetchMyRestaurant} />;
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-end gap-6">
        <div>
          <h2 className="text-4xl font-black text-gray-900 tracking-tight flex items-center gap-3">
             {restaurant.name}
             <span className={`text-[10px] px-3 py-1 rounded-full uppercase tracking-widest ${restaurant.is_open ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                {restaurant.is_open ? 'Live' : 'Closed'}
             </span>
          </h2>
          <p className="text-gray-400 font-medium">Merchant Dashboard • {restaurant.cuisine}</p>
        </div>
        
        <div className="flex bg-gray-100 p-1.5 rounded-2xl">
          {['orders', 'menu', 'settings'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-white text-[#FF5C00] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="pt-4">
        {activeTab === 'orders' && <MerchantOrders apiFetch={apiFetch} restaurantId={restaurant.id} />}
        {activeTab === 'menu' && <MerchantMenuManager apiFetch={apiFetch} restaurant={restaurant} onUpdate={fetchMyRestaurant} />}
        {activeTab === 'settings' && <MerchantSettings apiFetch={apiFetch} restaurant={restaurant} onUpdate={fetchMyRestaurant} />}
      </div>
    </div>
  );
};

const MerchantOnboarding = ({ apiFetch, onComplete }) => {
  const [form, setForm] = useState({ name: '', cuisine: '', address: '', slug: '', category: 'Trending' });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch('/api/restaurants', {
        method: 'POST',
        body: JSON.stringify(form)
      });
      onComplete();
    } catch (e) {
      alert(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl border border-gray-50 text-center">
        <span className="text-6xl mb-8 block font-black">🏪</span>
        <h2 className="text-4xl font-black text-gray-900 tracking-tight mb-4 text-center">Launch Your Kitchen.</h2>
        <p className="text-gray-400 font-medium mb-10 text-center">Join the FoodByte network and start reaching thousands of foodies.</p>
        
        <form onSubmit={handleSubmit} className="space-y-6 text-left">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-gray-400 ml-2">Restaurant Name</label>
              <input 
                required
                className="w-full bg-gray-50 border-2 border-transparent focus:border-[#FF5C00] focus:bg-white rounded-2xl p-4 outline-none transition-all font-bold"
                placeholder="e.g. John's Pizza"
                value={form.name}
                onChange={e => {
                  const val = e.target.value;
                  const cleansedSlug = val.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
                  setForm({...form, name: val, slug: cleansedSlug});
                }}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-gray-400 ml-2">Cuisine Type</label>
              <input 
                required
                className="w-full bg-gray-50 border-2 border-transparent focus:border-[#FF5C00] focus:bg-white rounded-2xl p-4 outline-none transition-all font-bold"
                placeholder="e.g. Italian, Burgers"
                value={form.cuisine}
                onChange={e => setForm({...form, cuisine: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-gray-400 ml-2">Store Address</label>
            <input 
              required
              className="w-full bg-gray-50 border-2 border-transparent focus:border-[#FF5C00] focus:bg-white rounded-2xl p-4 outline-none transition-all font-bold"
              placeholder="Full physical address"
              value={form.address}
              onChange={e => setForm({...form, address: e.target.value})}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-gray-400 ml-2">Unique URL (Slug)</label>
            <div className="relative">
              <span className="absolute left-4 top-4 text-gray-300 font-bold">foodbyte.app/</span>
              <input 
                required
                className="w-full bg-gray-50 border-2 border-transparent focus:border-[#FF5C00] focus:bg-white rounded-2xl p-4 pl-32 outline-none transition-all font-bold"
                placeholder="johns-pizza"
                value={form.slug}
                onChange={e => {
                  const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
                  setForm({...form, slug: val});
                }}
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={submitting}
            className="w-full bg-gray-900 text-white py-5 rounded-2xl font-black text-xl hover:bg-black transition-all transform hover:scale-[1.02] shadow-2xl mt-4 flex justify-center items-center gap-3"
          >
            {submitting ? <Spinner /> : "Register Restaurant"}
          </button>
        </form>
      </div>
    </div>
  );
};

const MerchantOrders = ({ apiFetch, restaurantId }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    try {
      const data = await apiFetch(`/api/orders/restaurant/${restaurantId}`);
      setOrders(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [apiFetch, restaurantId]);

  useEffect(() => {
    fetchOrders();
    const inv = setInterval(fetchOrders, 10000);
    return () => clearInterval(inv);
  }, [fetchOrders]);

  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      await apiFetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      });
      fetchOrders();
    } catch (e) { alert(e.message); }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {orders.length === 0 ? (
        <div className="lg:col-span-2 bg-white p-20 rounded-[3rem] text-center border-2 border-dashed border-gray-100">
           <h3 className="text-xl font-bold text-gray-400">No active orders.</h3>
           <p className="text-sm text-gray-300">Your kitchen is ready for new requests.</p>
        </div>
      ) : (
        orders.map(order => (
          <div key={order.id} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-50 flex flex-col">
            <div className="flex justify-between items-start mb-6">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 bg-gray-50 px-2 py-1 rounded">Order #{order.id.toString().substring(0,8)}</span>
                <p className="text-sm font-bold text-gray-400 mt-2 italic">To: {order.delivery_address}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black text-gray-900">${order.total_price.toFixed(2)}</p>
                <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${order.is_paid ? 'text-green-500' : 'text-orange-400'}`}>
                  {order.is_paid ? 'Paid' : 'Awaiting Payment'}
                </p>
              </div>
            </div>

            <div className="space-y-3 mb-8 bg-gray-50/50 p-6 rounded-2xl">
              {order.items.map(i => (
                <div key={i.item_id} className="flex justify-between text-sm">
                  <span className="font-bold text-gray-700">x{i.quantity} {i.name}</span>
                  <span className="font-medium text-gray-400">${(i.unit_price * i.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="mt-auto grid grid-cols-2 gap-3">
              <div className="col-span-2 mb-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Current Status: {order.status}</label>
              </div>
              <button 
                onClick={() => handleUpdateStatus(order.id, 'confirmed')}
                className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${order.status === 'confirmed' ? 'bg-orange-500 text-white shadow-lg' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
              >
                Confirm
              </button>
              <button 
                onClick={() => handleUpdateStatus(order.id, 'preparing')}
                className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${order.status === 'preparing' ? 'bg-indigo-500 text-white shadow-lg' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
              >
                Prepare
              </button>
              <button 
                onClick={() => handleUpdateStatus(order.id, 'ready')}
                className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${order.status === 'ready' ? 'bg-green-500 text-white shadow-lg' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
              >
                Ready
              </button>
              <button 
                onClick={() => handleUpdateStatus(order.id, 'cancelled')}
                className="py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleUpdateStatus(order.id, 'delivered')}
                className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${order.status === 'delivered' ? 'bg-gray-900 text-white shadow-lg' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
              >
                Deliver
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

const MerchantMenuManager = ({ apiFetch, restaurant, onUpdate }) => {
  const [newItem, setNewItem] = useState({ name: '', description: '', price: '', category: 'main' });
  const [adding, setAdding] = useState(false);

  const handleAddItem = async (e) => {
    e.preventDefault();
    setAdding(true);
    try {
      await apiFetch(`/api/restaurants/${restaurant.id}/menu`, {
        method: 'POST',
        body: JSON.stringify({ ...newItem, price: parseFloat(newItem.price) })
      });
      setNewItem({ name: '', description: '', price: '', category: 'main' });
      onUpdate();
    } catch (e) { alert(e.message); }
    finally { setAdding(false); }
  };

  const handleRemoveItem = async (itemId) => {
    if (!confirm("Remove this item?")) return;
    try {
      await apiFetch(`/api/restaurants/${restaurant.id}/menu/${itemId}`, { method: 'DELETE' });
      onUpdate();
    } catch (e) { alert(e.message); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
      <div className="lg:col-span-1">
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-50 sticky top-28">
           <h3 className="text-xl font-black mb-6">Add Menu Item.</h3>
           <form onSubmit={handleAddItem} className="space-y-4">
              <input 
                required
                className="w-full bg-gray-50 border-transparent rounded-xl p-4 outline-none font-bold text-sm focus:bg-white focus:ring-2 focus:ring-orange-100"
                placeholder="Item Name (e.g. Classic Burger)"
                value={newItem.name}
                onChange={e => setNewItem({...newItem, name: e.target.value})}
              />
              <textarea 
                className="w-full bg-gray-50 border-transparent rounded-xl p-4 outline-none font-medium text-sm focus:bg-white focus:ring-2 focus:ring-orange-100 h-24"
                placeholder="Short description..."
                value={newItem.description}
                onChange={e => setNewItem({...newItem, description: e.target.value})}
              />
              <div className="flex gap-3">
                <input 
                  required
                  type="number"
                  step="0.01"
                  className="w-1/2 bg-gray-50 border-transparent rounded-xl p-4 outline-none font-bold text-sm focus:bg-white focus:ring-2 focus:ring-orange-100"
                  placeholder="Price"
                  value={newItem.price}
                  onChange={e => setNewItem({...newItem, price: e.target.value})}
                />
                <select 
                  className="w-1/2 bg-gray-50 border-transparent rounded-xl p-4 outline-none font-bold text-sm focus:bg-white focus:ring-2 focus:ring-orange-100"
                  value={newItem.category}
                  onChange={e => setNewItem({...newItem, category: e.target.value})}
                >
                  <option value="main">Main</option>
                  <option value="side">Side</option>
                  <option value="drink">Drink</option>
                  <option value="dessert">Dessert</option>
                </select>
              </div>
              <button 
                type="submit"
                disabled={adding}
                className="w-full bg-[#FF5C00] text-white py-4 rounded-xl font-black text-sm uppercase tracking-widest hover:bg-[#E55200] transition-all shadow-lg shadow-orange-50 disabled:opacity-50"
              >
                {adding ? <Spinner /> : "Add to Menu"}
              </button>
           </form>
        </div>
      </div>

      <div className="lg:col-span-2 space-y-6">
        <h3 className="text-xl font-black mb-2">My Current Menu.</h3>
        {restaurant.menu.length === 0 ? (
          <div className="bg-gray-50 p-20 rounded-[3rem] text-center border-2 border-dashed border-gray-200">
             <p className="font-bold text-gray-300">Your menu is empty.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {restaurant.menu.map(item => (
              <div key={item.item_id} className="bg-white p-6 rounded-3xl border border-gray-100 flex justify-between items-center group hover:border-orange-200 transition-colors">
                <div>
                   <div className="flex items-center gap-3">
                     <span className="text-[10px] bg-gray-100 text-gray-400 font-black px-2 py-0.5 rounded uppercase">{item.category}</span>
                     <h4 className="font-black text-lg text-gray-900">{item.name}</h4>
                   </div>
                   <p className="text-xs text-gray-400 mt-1 max-w-md">{item.description}</p>
                </div>
                <div className="flex items-center gap-6">
                  <span className="font-black text-gray-900">${item.price.toFixed(2)}</span>
                  <button onClick={() => handleRemoveItem(item.item_id)} className="text-gray-300 hover:text-red-500 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const MerchantSettings = ({ apiFetch, restaurant, onUpdate }) => {
  const [statusLoading, setStatusLoading] = useState(false);

  const toggleStatus = async () => {
    setStatusLoading(true);
    try {
      await apiFetch(`/api/restaurants/${restaurant.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_open: !restaurant.is_open })
      });
      onUpdate();
    } catch (e) { alert(e.message); }
    finally { setStatusLoading(false); }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-12">
       <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-gray-50">
          <h3 className="text-xl font-black mb-6">Operational Status.</h3>
          <div className={`p-8 rounded-[2rem] border-2 flex items-center justify-between transition-all ${restaurant.is_open ? 'border-green-100 bg-green-50/20' : 'border-gray-100 bg-gray-50/50'}`}>
             <div>
                <p className={`font-black uppercase tracking-widest text-xs ${restaurant.is_open ? 'text-green-600' : 'text-gray-400'}`}>
                  {restaurant.is_open ? 'Accepting Orders' : 'Kitchen Closed'}
                </p>
                <p className="text-sm text-gray-400 font-medium mt-1">Control your visibility on the browse page.</p>
             </div>
             <button 
              onClick={toggleStatus}
              disabled={statusLoading}
              className={`w-16 h-8 rounded-full relative transition-all ${restaurant.is_open ? 'bg-green-500' : 'bg-gray-300'}`}
             >
                <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-all ${restaurant.is_open ? 'left-9' : 'left-1'}`}></div>
             </button>
          </div>
       </div>

       <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-gray-50 opacity-40">
          <h3 className="text-xl font-black mb-6">Business Details (Locked)</h3>
          <p className="text-sm text-gray-400">To change your cuisine or location, please contact FoodByte Support.</p>
       </div>
    </div>
  );
};



// ── LOGIN/REGISTER & UTILITIES ──────────────────────────────────────────────

const Login = ({ onLogin, onSwitch, apiFetch }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr(''); setLoading(true);
    try {
      const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      onLogin(data.access_token, data.user);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="max-w-md mx-auto mt-16 bg-white rounded-[2.5rem] shadow-2xl p-12 border border-gray-50">
      <h2 className="text-3xl font-black mb-8 text-center text-gray-900 tracking-tight">Login.</h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Email</label>
          <input type="email" required className="w-full bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-orange-200 font-medium" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Password</label>
          <input type="password" required className="w-full bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-orange-200 font-medium" value={password} onChange={e => setPassword(e.target.value)} />
        </div>
        {err && <p className="text-red-500 text-xs font-bold text-center">{err}</p>}
        <button disabled={loading} type="submit" className="w-full bg-gray-900 text-white p-4 rounded-2xl hover:bg-black transition font-black flex justify-center shadow-xl">
          {loading ? <Spinner /> : 'Login'}
        </button>
      </form>
      <p className="mt-8 text-center text-sm font-bold text-gray-400 uppercase tracking-widest opacity-60">
        New here? <button onClick={onSwitch} className="text-[#FF5C00] hover:underline">Register</button>
      </p>
    </div>
  );
};

const Register = ({ onRegister, onSwitch, apiFetch }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('customer');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr(''); setLoading(true);
    try {
      const data = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, name, password, role })
      });
      onRegister(data.access_token, data.user);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="max-w-md mx-auto mt-16 bg-white rounded-[2.5rem] shadow-2xl p-12 border border-gray-50">
      <h2 className="text-3xl font-black mb-8 text-center text-gray-900 tracking-tight">Register.</h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Full Name</label>
          <input type="text" required className="w-full bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-orange-200 font-medium" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Email</label>
          <input type="email" required className="w-full bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-orange-200 font-medium" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Password</label>
          <input type="password" required className="w-full bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-orange-200 font-medium" value={password} onChange={e => setPassword(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Account Type</label>
          <select className="w-full bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-orange-200 font-black uppercase text-xs" value={role} onChange={e => setRole(e.target.value)}>
            <option value="customer">I'm a Customer</option>
            <option value="restaurant">I'm a Restaurant Owner</option>
          </select>
        </div>
        {err && <p className="text-red-500 text-xs font-bold text-center">{err}</p>}
        <button disabled={loading} type="submit" className="w-full bg-gray-900 text-white p-4 rounded-2xl hover:bg-black transition font-black flex justify-center shadow-xl">
          {loading ? <Spinner /> : 'Register'}
        </button>
      </form>
      <p className="mt-8 text-center text-sm font-bold text-gray-400 uppercase tracking-widest opacity-60">
        Already have an account? <button onClick={onSwitch} className="text-[#FF5C00] hover:underline">Login</button>
      </p>
    </div>
  );
};

const Footer = () => (
  <footer className="bg-white border-t border-gray-100 py-16">
    <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center opacity-60">
      <div className="flex items-center space-x-2 mb-4 md:mb-0">
         <span className="font-extrabold text-2xl text-gray-900">FoodByte</span>
         <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">© 2026 FoodByte Inc.</span>
      </div>
      <div className="flex space-x-6 text-xs font-bold text-gray-400 uppercase tracking-widest">
        <button className="hover:text-gray-900">Privacy</button>
        <button className="hover:text-gray-900">Terms</button>
        <button className="hover:text-gray-900">Help</button>
      </div>
    </div>
  </footer>
);

const Spinner = () => (
  <svg className="animate-spin h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

const PageLoader = () => (
  <div className="fixed inset-0 bg-white flex flex-col items-center justify-center p-20 z-[999]">
    <div className="w-16 h-16 border-4 border-gray-100 border-t-[#FF5C00] rounded-full animate-spin mb-6 shadow-2xl shadow-orange-50"></div>
    <span className="text-2xl font-black tracking-tighter text-gray-200">FoodByte</span>
  </div>
);
