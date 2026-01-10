import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, User, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function Dashboard() {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-xl">M</span>
                            </div>
                            <h1 className="text-2xl font-bold text-gray-900">Magic Story Studio</h1>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                <User className="h-4 w-4" />
                                <span>{user?.email}</span>
                            </div>
                            <button
                                onClick={signOut}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:text-red-600 transition-colors"
                            >
                                <LogOut className="h-4 w-4" />
                                Sair
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12">
                    <div className="text-center max-w-2xl mx-auto">
                        <div className="w-20 h-20 bg-gradient-to-br from-red-100 to-red-200 rounded-full flex items-center justify-center mx-auto mb-6">
                            <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>

                        <h2 className="text-3xl font-bold text-gray-900 mb-4">
                            Bem-vindo ao Magic Story Studio
                        </h2>

                        <p className="text-lg text-gray-600 mb-8">
                            Crie histórias incríveis com o poder da IA!
                        </p>

                        <button
                            onClick={() => navigate('/studio')}
                            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold rounded-xl hover:from-red-600 hover:to-red-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
                        >
                            <Sparkles className="h-5 w-5" />
                            Ir para o Studio
                        </button>

                        <div className="mt-8 inline-flex items-center gap-2 px-6 py-3 bg-gray-100 rounded-lg text-sm text-gray-600">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <span>Sistema pronto para uso</span>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
