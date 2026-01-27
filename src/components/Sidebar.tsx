import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Sparkles, Settings, LogOut, User, TestTube, Home, Video, FolderOpen } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface SidebarProps {
    currentPage: 'stories' | 'prompt-master' | 'settings' | 'image-test' | 'studio' | 'files';
    onNavigate: (page: 'stories' | 'prompt-master' | 'settings' | 'image-test' | 'studio' | 'files') => void;
    isOpen: boolean;
}

export function Sidebar({ currentPage, onNavigate, isOpen }: SidebarProps) {
    const { user, signOut } = useAuth();

    // Items for the main section - each with unique identifier
    const mainItems = [
        { id: 'stories' as const, label: 'Início', icon: Home },
        { id: 'studio' as const, label: 'Studio', icon: Video },
        { id: 'files' as const, label: 'Biblioteca', icon: FolderOpen },
        { id: 'prompt-master' as const, label: 'Prompt Mestre', icon: Sparkles },
        { id: 'image-test' as const, label: 'Teste de Imagens', icon: TestTube },
    ];

    // Items for the bottom/secondary section
    const secondaryItems = [
        { id: 'settings' as const, label: 'Configurações', icon: Settings },
    ];

    return (
        <motion.aside
            className="h-full bg-background border-r border-border z-40 flex flex-col overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-600 hover:scrollbar-thumb-gray-500"
            initial={false}
            animate={{ width: isOpen ? '240px' : '72px' }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
            <div className="flex-1 py-3 px-3 space-y-6">

                {/* Main Section */}
                <div className="space-y-1">
                    {mainItems.map((item) => {
                        const Icon = item.icon;
                        const active = currentPage === item.id;

                        return (
                            <button
                                key={item.id}
                                onClick={() => onNavigate(item.id)}
                                className={`w-full flex items-center gap-5 px-3 py-3 rounded-lg transition-colors ${active
                                    ? 'bg-secondary font-medium text-white'
                                    : 'hover:bg-secondary/80 text-gray-300 hover:text-white'
                                    }`}
                                title={!isOpen ? item.label : ''}
                            >
                                <Icon className={`h-6 w-6 flex-shrink-0 ${active ? 'text-primary' : 'text-white'}`} strokeWidth={active ? 2.5 : 2} />
                                <span className={`whitespace-nowrap overflow-hidden text-sm ${isOpen ? 'opacity-100' : 'opacity-0 hidden'} ${active ? 'font-semibold' : ''}`}>
                                    {item.label}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {isOpen && <div className="border-t border-border mx-1" />}

                {/* Secondary Section */}
                <div className="space-y-1">
                    {isOpen && (
                        <h3 className="px-3 py-2 text-base font-semibold text-white">
                            Você
                        </h3>
                    )}
                    {secondaryItems.map((item) => {
                        const Icon = item.icon;
                        const active = currentPage === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => onNavigate(item.id)}
                                className={`w-full flex items-center gap-5 px-3 py-3 rounded-lg transition-colors ${active
                                    ? 'bg-secondary font-medium text-white'
                                    : 'hover:bg-secondary/80 text-gray-300 hover:text-white'
                                    }`}
                                title={!isOpen ? item.label : ''}
                            >
                                <Icon className={`h-6 w-6 flex-shrink-0 ${active ? 'text-primary' : 'text-white'}`} />
                                <span className={`whitespace-nowrap overflow-hidden text-sm ${isOpen ? 'opacity-100' : 'opacity-0 hidden'} ${active ? 'font-semibold' : ''}`}>
                                    {item.label}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Footer / Sign Out */}
            <div className="p-3 mt-auto border-t border-border">
                <button
                    onClick={signOut}
                    className="w-full flex items-center gap-5 px-3 py-3 rounded-lg hover:bg-secondary/80 text-white transition-colors"
                    title={!isOpen ? 'Sair' : ''}
                >
                    <LogOut className="h-6 w-6 flex-shrink-0" />
                    <span className={`whitespace-nowrap overflow-hidden text-sm ${isOpen ? 'opacity-100' : 'opacity-0 hidden'}`}>
                        Sair
                    </span>
                </button>
            </div>
        </motion.aside>
    );
}
