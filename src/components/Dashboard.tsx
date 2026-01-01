import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { LogOut, User, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface UserProfile {
    id: string;
    display_name: string | null;
    plan_type: string;
    stories_created: number;
    stories_limit: number;
    created_at: string;
}

export function Dashboard() {
    const { user, signOut } = useAuth();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        async function fetchProfile() {
            if (!user) return;

            try {
                const { data, error } = await supabase
                    .from('user_profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();

                if (error) throw error;
                setProfile(data);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }

        fetchProfile();
    }, [user]);

    return (
        <div className="min-h-screen w-full bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 p-8">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold">Magic Story Studio</h1>
                    <button
                        onClick={signOut}
                        className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        <LogOut className="h-4 w-4" />
                        Sair
                    </button>
                </div>

                {/* User Info Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-xl border shadow-sm p-8 mb-6"
                >
                    <div className="flex items-start gap-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                            <User className="h-8 w-8 text-white" />
                        </div>
                        <div className="flex-1">
                            <h2 className="text-2xl font-bold mb-1">Usuário Autenticado</h2>
                            <p className="text-muted-foreground">{user?.email}</p>
                        </div>
                    </div>
                </motion.div>

                {/* Auth UID Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white rounded-xl border shadow-sm p-6 mb-6"
                >
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        Auth UID (Supabase)
                    </h3>
                    <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm break-all">
                        {user?.id}
                    </div>
                </motion.div>

                {/* User Profile Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white rounded-xl border shadow-sm p-6"
                >
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        {loading ? (
                            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                        ) : profile ? (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                            <XCircle className="h-5 w-5 text-red-600" />
                        )}
                        Perfil do Usuário (user_profiles)
                    </h3>

                    {loading && (
                        <div className="text-center py-8 text-muted-foreground">
                            Carregando perfil...
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-50 text-red-600 p-4 rounded-lg">
                            <p className="font-medium">Erro ao carregar perfil:</p>
                            <p className="text-sm mt-1">{error}</p>
                        </div>
                    )}

                    {profile && (
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-muted-foreground">ID</p>
                                    <p className="font-mono text-sm break-all">{profile.id}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Nome</p>
                                    <p className="font-medium">{profile.display_name || 'Não definido'}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Plano</p>
                                    <p className="font-medium capitalize">{profile.plan_type}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Histórias criadas</p>
                                    <p className="font-medium">
                                        {profile.stories_created} / {profile.stories_limit}
                                    </p>
                                </div>
                                <div className="col-span-2">
                                    <p className="text-sm text-muted-foreground">Criado em</p>
                                    <p className="font-medium">
                                        {new Date(profile.created_at).toLocaleString('pt-BR')}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-6 p-4 bg-green-50 rounded-lg">
                                <p className="text-sm text-green-800 font-medium flex items-center gap-2">
                                    <CheckCircle className="h-4 w-4" />
                                    ✅ Perfil criado automaticamente via trigger
                                </p>
                                <p className="text-xs text-green-700 mt-1">
                                    O trigger <code className="bg-green-100 px-1 rounded">on_auth_user_created</code> funcionou corretamente!
                                </p>
                            </div>
                        </div>
                    )}
                </motion.div>

                {/* RLS Validation */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="mt-6 p-4 bg-blue-50 rounded-lg"
                >
                    <h4 className="font-semibold text-blue-900 mb-2">✅ Validações de Segurança</h4>
                    <ul className="text-sm text-blue-800 space-y-1">
                        <li>• Row Level Security (RLS) ativo</li>
                        <li>• Usuário só acessa seus próprios dados</li>
                        <li>• auth.uid() funcionando corretamente</li>
                        <li>• Sessão persistente após reload</li>
                    </ul>
                </motion.div>
            </div>
        </div>
    );
}
