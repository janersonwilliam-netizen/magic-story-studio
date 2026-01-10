import React from 'react';
import { Menu, Search, Video, Bell, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface TopBarProps {
    onMenuClick: () => void;
}

export function TopBar({ onMenuClick }: TopBarProps) {
    const { user } = useAuth();

    return (
        <header className="sticky top-0 z-50 w-full bg-[#0f0f0f] px-4 h-14 flex items-center justify-between border-b border-[#272727] shadow-sm">
            <div className="flex items-center gap-4">
                <button
                    onClick={onMenuClick}
                    className="p-2 hover:bg-[#272727] rounded-full transition-colors focus:outline-none"
                    aria-label="Menu"
                >
                    <Menu className="h-6 w-6 text-white" />
                </button>
                <div className="flex items-center gap-1 cursor-pointer">
                    <div className="relative h-8 w-8 flex items-center justify-center">
                        <span className="text-2xl">✨</span>
                    </div>
                    <span className="font-semibold text-xl tracking-tight text-white hidden sm:block">
                        Magic Studio
                    </span>
                </div>
            </div>

            <div className="hidden md:flex flex-1 max-w-2xl mx-8">
                <div className="flex w-full group">
                    <div className="flex-1 flex items-center bg-[#121212] border border-[#303030] rounded-l-full px-4 py-2 group-focus-within:border-blue-500 ml-8 shadow-inner">
                        <Search className="h-4 w-4 text-gray-400 mr-2 group-focus-within:hidden" />
                        <input
                            type="text"
                            placeholder="Pesquisar..."
                            className="w-full bg-transparent focus:outline-none text-white placeholder-gray-500"
                        />
                    </div>
                    <button className="px-6 py-2 bg-[#222222] border border-l-0 border-[#303030] rounded-r-full hover:bg-[#303030] transition-colors">
                        <Search className="h-5 w-5 text-white" />
                    </button>
                </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
                <button className="hidden sm:flex p-2 hover:bg-[#272727] rounded-full transition-colors" title="Criar">
                    <Video className="h-6 w-6 text-white" />
                </button>
                <button className="p-2 hover:bg-[#272727] rounded-full transition-colors relative" title="Notificações">
                    <Bell className="h-6 w-6 text-white" />
                    <span className="absolute top-1 right-1 h-4 w-4 bg-[#CC0000] rounded-full text-[10px] text-white flex items-center justify-center border-2 border-[#0f0f0f]">
                        2
                    </span>
                </button>
                <div className="ml-2 h-8 w-8 bg-[#FF0000] rounded-full flex items-center justify-center text-white font-medium cursor-pointer hover:bg-red-700 transition-colors">
                    {user?.email?.charAt(0).toUpperCase() || <User className="h-5 w-5" />}
                </div>
            </div>
        </header>
    );
}

