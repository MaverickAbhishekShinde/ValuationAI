import React, { useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import axios from 'axios';

const SearchBar = ({ onDataFetched }) => {
    const [ticker, setTicker] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Debounce logic for suggestions
    React.useEffect(() => {
        const fetchSuggestions = async () => {
            if (ticker.length < 2) {
                setSuggestions([]);
                return;
            }

            try {
                const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
                const response = await axios.get(`${apiUrl}/api/suggest/${ticker}`);
                setSuggestions(response.data);
                setShowSuggestions(true);
            } catch (err) {
                console.error("Failed to fetch suggestions", err);
            }
        };

        const timeoutId = setTimeout(() => {
            if (ticker.trim()) {
                fetchSuggestions();
            } else {
                setSuggestions([]);
            }
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [ticker]);

    const performSearch = async (searchTicker) => {
        setLoading(true);
        setError('');

        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
            const response = await axios.get(`${apiUrl}/api/search/${searchTicker}`);

            if (response.data.error) {
                setError(response.data.error);
            } else {
                onDataFetched(response.data);
                setError('');
            }
        } catch (err) {
            console.error("Search failed:", err);
            setError("Failed to fetch data. Check ticker or backend.");
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e) => {
        if (e) e.preventDefault();
        if (!ticker.trim()) return;
        setShowSuggestions(false);
        performSearch(ticker.trim());
    };

    const handleSuggestionClick = (suggestion) => {
        setTicker(suggestion.symbol);
        setShowSuggestions(false);
        // Trigger search immediately for better UX
        performSearch(suggestion.symbol);
    };

    return (
        <div className="mb-6 relative z-50">
            <form onSubmit={handleSearch} className="relative">
                <input
                    type="text"
                    value={ticker}
                    onChange={(e) => setTicker(e.target.value)}
                    onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} // Delay to allow click
                    placeholder="Search Company Name (e.g. Zomato, Reliance)..."
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-xl pl-12 pr-4 py-4 text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all placeholder:text-slate-500"
                />
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />

                <button
                    type="submit"
                    disabled={loading || !ticker}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? <Loader2 className="animate-spin" size={18} /> : "Auto-Fill"}
                </button>
            </form>

            {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto">
                    <ul>
                        {suggestions.map((s) => (
                            <li
                                key={s.symbol}
                                onMouseDown={(e) => {
                                    e.preventDefault(); // Prevent blur
                                    handleSuggestionClick(s);
                                }}
                                className="px-4 py-3 hover:bg-slate-700 cursor-pointer flex justify-between items-center border-b border-slate-700/50 last:border-0"
                            >
                                <div>
                                    <p className="text-white font-medium">{s.name}</p>
                                    <p className="text-xs text-slate-400">{s.symbol}</p>
                                </div>
                                <span className="text-xs bg-slate-900 text-slate-400 px-2 py-1 rounded">
                                    {s.exchange}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {error && (
                <p className="mt-2 text-red-400 text-sm flex items-center gap-2">
                    <span>•</span> {error}
                </p>
            )}
        </div>
    );
};

export default SearchBar;
