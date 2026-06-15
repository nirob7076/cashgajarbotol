// File: src/App.jsx (Frontend)
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, CheckSquare, Wallet, Loader2 } from 'lucide-react';

const API_URL = "https://cashgajarbotol.vercel.app/api.php"; // আপনার api.php এর ডাইরেক্ট লিংক দিন

export default function App() {
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('home');
    const [user, setUser] = useState(null);
    const [settings, setSettings] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [btnTimer, setBtnTimer] = useState(0);

    useEffect(() => {
        const tg = window.Telegram?.WebApp;
        if (tg) {
            tg.expand();
            const tgUser = tg.initDataUnsafe?.user || { id: 1234567, first_name: 'Test User', photo_url: '' }; 
            const start_param = tg.initDataUnsafe?.start_param;

            axios.post(`${API_URL}?action=init`, { user: tgUser, start_param })
                .then(res => {
                    setUser(res.data.user);
                    setSettings(res.data.settings);
                    setTasks(res.data.tasks);
                    setTimeout(() => setLoading(false), 2000); 
                }).catch(err => console.log(err));
        }
    }, []);

    const triggerCooldown = () => {
        setBtnTimer(4);
        const interval = setInterval(() => {
            setBtnTimer(prev => {
                if (prev <= 1) clearInterval(interval);
                return prev - 1;
            });
        }, 1000);
    };

    const handleWatchAd = () => {
        if (btnTimer > 0) return;
        triggerCooldown();
        
        // Monetag Ad Code (Dynamic Zone ID from settings)
        alert(`Loading Ad for Zone ID: ${settings?.monetag_zone_id} (15 Sec)`); 
        
        setTimeout(() => {
            axios.post(`${API_URL}?action=watch-ad`, { telegram_id: user.telegram_id })
                .then(res => {
                    alert(res.data.message);
                    if (res.data.success) {
                        setUser(prev => ({ ...prev, balance: prev.balance + settings.ad_reward, daily_ads_watched: prev.daily_ads_watched + 1 }));
                    }
                });
        }, 15000); // 15s timer for Ad
    };

    const handleVerifyTask = (task) => {
        if (btnTimer > 0) return;
        triggerCooldown();

        axios.post(`${API_URL}?action=verify-task`, { 
            telegram_id: user.telegram_id, 
            task_id: task.id, 
            channel_id: task.channel_id,
            reward: task.reward
        }).then(res => {
            alert(res.data.message);
            if(res.data.success) {
                setTasks(tasks.filter(t => t.id !== task.id));
                setUser(prev => ({ ...prev, balance: prev.balance + task.reward }));
            }
        });
    };

    const handleWithdraw = (e) => {
        e.preventDefault();
        const method = e.target.method.value;
        const number = e.target.number.value;
        const amount = e.target.amount.value;

        axios.post(`${API_URL}?action=withdraw`, { telegram_id: user.telegram_id, method, number, amount })
            .then(res => {
                alert(res.data.message);
                if(res.data.success) window.location.reload();
            });
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white">
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                    <Loader2 size={60} className="text-blue-500" />
                </motion.div>
                <h1 className="mt-4 text-xl font-bold animate-pulse">Loading App...</h1>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white font-sans pb-20">
            {/* Header */}
            <div className="bg-gray-800 p-4 sticky top-0 z-10 shadow-md">
                <h1 className="text-center font-bold text-lg text-blue-400">Mini App</h1>
            </div>

            <div className="p-4">
                <AnimatePresence mode='wait'>
                    {/* HOME PAGE */}
                    {activeTab === 'home' && (
                        <motion.div initial={{ opacity:0, x:-20 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:20 }}>
                            <div className="bg-gray-800 rounded-xl p-5 text-center border border-gray-700 shadow-lg">
                                <img src={user?.photo_url || 'https://via.placeholder.com/100'} alt="Profile" className="w-20 h-20 rounded-full mx-auto border-4 border-blue-500 shadow-xl" />
                                <h2 className="text-xl font-bold mt-3">{user?.first_name}</h2>
                                <div className="mt-4 bg-gray-700 rounded-lg p-3">
                                    <p className="text-sm text-gray-300 mb-1">একাউন্ট ব্যালেন্স</p>
                                    <h1 className="text-3xl font-extrabold text-green-400">৳{user?.balance}</h1>
                                </div>
                            </div>

                            <div className="mt-5 bg-gray-800 rounded-xl p-5 border border-gray-700">
                                <h3 className="text-lg font-bold text-yellow-400 mb-2">রেফার লিংক</h3>
                                <p className="text-sm text-gray-300 mb-4">{settings?.referral_text}</p>
                                <div className="bg-gray-900 p-3 rounded text-xs text-center break-all text-blue-300 font-mono">
                                    https://t.me/{settings?.bot_username}/app?startapp={user?.telegram_id}
                                </div>
                                <button onClick={() => navigator.clipboard.writeText(`https://t.me/${settings?.bot_username}/app?startapp=${user?.telegram_id}`)} className="w-full mt-3 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg transition">
                                    Copy Link
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* TASKS PAGE */}
                    {activeTab === 'tasks' && (
                        <motion.div initial={{ opacity:0, x:-20 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:20 }}>
                            <div className="bg-gray-800 rounded-xl p-5 mb-5 border border-gray-700 text-center">
                                <h3 className="text-lg font-bold text-white mb-2">Watch Ads</h3>
                                <p className="text-sm text-gray-400 mb-4">Today's Limit: {user?.daily_ads_watched} / {settings?.daily_ad_limit}</p>
                                <button onClick={handleWatchAd} disabled={btnTimer > 0 || user?.daily_ads_watched >= settings?.daily_ad_limit} className={`w-full font-bold py-3 rounded-lg transition ${btnTimer > 0 || user?.daily_ads_watched >= settings?.daily_ad_limit ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 text-white'}`}>
                                    {btnTimer > 0 ? `Wait ${btnTimer}s...` : 'Watch Now (15s)'}
                                </button>
                            </div>

                            <h3 className="font-bold text-lg mb-3">Available Tasks</h3>
                            {tasks.map(task => (
                                <div key={task.id} className="bg-gray-800 rounded-xl p-4 mb-3 flex flex-col border border-gray-700 shadow-md">
                                    <div className="flex items-center gap-3 mb-3">
                                        <img src={task.image_url} alt="Task" className="w-12 h-12 rounded-lg object-cover" />
                                        <div>
                                            <h4 className="font-bold text-md">{task.title}</h4>
                                            <p className="text-xs text-green-400 font-bold">Reward: ৳{task.reward}</p>
                                        </div>
                                    </div>
                                    <p className="text-sm text-gray-400 mb-3">{task.description}</p>
                                    <div className="flex gap-2">
                                        <a href={task.task_link} target="_blank" rel="noreferrer" className="flex-1 bg-blue-600 hover:bg-blue-700 text-center text-white py-2 rounded-lg text-sm font-bold">Open Task</a>
                                        <button onClick={() => handleVerifyTask(task)} disabled={btnTimer > 0} className={`flex-1 py-2 rounded-lg text-sm font-bold ${btnTimer > 0 ? 'bg-gray-600' : 'bg-green-600 hover:bg-green-700'} text-white`}>
                                            Verify {btnTimer > 0 && `(${btnTimer})`}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </motion.div>
                    )}

                    {/* WITHDRAW PAGE */}
                    {activeTab === 'withdraw' && (
                        <motion.div initial={{ opacity:0, x:-20 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:20 }}>
                            <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
                                <h3 className="text-xl font-bold mb-1">উত্তোলন করুন</h3>
                                <p className="text-sm text-red-400 mb-4">Required Ads: {settings?.min_ads_for_withdraw} (Watched: {user?.total_ads_watched})</p>

                                <form onSubmit={handleWithdraw} className="flex flex-col gap-4">
                                    <div>
                                        <label className="text-sm text-gray-300">পেমেন্ট মেথড</label>
                                        <select name="method" className="w-full mt-1 p-3 bg-gray-900 border border-gray-700 rounded-lg text-white outline-none">
                                            {settings?.bkash_enabled && <option value="bKash">bKash</option>}
                                            {settings?.nagad_enabled && <option value="Nagad">Nagad</option>}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-sm text-gray-300">অ্যাকাউন্ট নাম্বার</label>
                                        <input required name="number" type="number" placeholder="017XXXXXXX" className="w-full mt-1 p-3 bg-gray-900 border border-gray-700 rounded-lg text-white outline-none" />
                                    </div>
                                    <div>
                                        <label className="text-sm text-gray-300">পরিমাণ</label>
                                        <input required name="amount" type="number" placeholder={`Min ৳${settings?.min_withdraw}`} className="w-full mt-1 p-3 bg-gray-900 border border-gray-700 rounded-lg text-white outline-none" />
                                    </div>
                                    <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg mt-2 transition">রিকোয়েস্ট দিন</button>
                                </form>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Bottom Nav */}
            <div className="fixed bottom-0 w-full bg-gray-800 border-t border-gray-700 flex justify-around p-3 z-50">
                <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center ${activeTab === 'home' ? 'text-blue-400' : 'text-gray-400'}`}><Home size={24} /><span className="text-xs">Home</span></button>
                <button onClick={() => setActiveTab('tasks')} className={`flex flex-col items-center ${activeTab === 'tasks' ? 'text-blue-400' : 'text-gray-400'}`}><CheckSquare size={24} /><span className="text-xs">Tasks</span></button>
                <button onClick={() => setActiveTab('withdraw')} className={`flex flex-col items-center ${activeTab === 'withdraw' ? 'text-blue-400' : 'text-gray-400'}`}><Wallet size={24} /><span className="text-xs">Withdraw</span></button>
            </div>
        </div>
    );
}
