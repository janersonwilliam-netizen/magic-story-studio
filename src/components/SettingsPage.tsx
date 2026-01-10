import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Save, Loader2, Check, User, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export function SettingsPage() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');

    // Profile
    const [displayName, setDisplayName] = useState('');

    // Password
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [changingPassword, setChangingPassword] = useState(false);
    const [passwordChanged, setPasswordChanged] = useState(false);

    useEffect(() => {
        loadPreferences();
    }, []);

    async function loadPreferences() {
        try {
            setLoading(true);
            const { data, error: fetchError } = await supabase
                .from('user_preferences')
                .select('display_name')
                .eq('user_id', user?.id)
                .single();

            if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

            if (data) {
                setDisplayName(data.display_name || '');
            }
        } catch (err: any) {
            console.error('Error loading preferences:', err);
        } finally {
            setLoading(false);
        }
    }

    async function handleSaveProfile() {
        try {
            setSaving(true);
            setError('');

            const { error: upsertError } = await supabase
                .from('user_preferences')
                .upsert({
                    user_id: user?.id,
                    display_name: displayName.trim() || null,
                }, { onConflict: 'user_id' });

            if (upsertError) throw upsertError;

            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    }

    async function handleChangePassword() {
        try {
            setChangingPassword(true);
            setError('');

            // Validations
            if (!newPassword || newPassword.length < 6) {
                throw new Error('A nova senha deve ter pelo menos 6 caracteres');
            }

            if (newPassword !== confirmPassword) {
                throw new Error('As senhas não coincidem');
            }

            // Update password
            const { error: updateError } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (updateError) throw updateError;

            setPasswordChanged(true);
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setTimeout(() => setPasswordChanged(false), 3000);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setChangingPassword(false);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-[#FF0000]" />
            </div>
        );
    }

    return (
        <div className="w-full space-y-6">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-2">⚙️ Configurações</h1>
                    <p className="text-muted-foreground">
                        Gerencie seu perfil e preferências
                    </p>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-lg">
                        {error}
                    </div>
                )}

                {/* Success Messages */}
                {saved && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-green-50 text-green-600 p-4 rounded-lg flex items-center gap-2"
                    >
                        <Check className="h-5 w-5" />
                        Perfil atualizado com sucesso!
                    </motion.div>
                )}

                {passwordChanged && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-green-50 text-green-600 p-4 rounded-lg flex items-center gap-2"
                    >
                        <Check className="h-5 w-5" />
                        Senha alterada com sucesso!
                    </motion.div>
                )}

                {/* Profile Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-xl border shadow-sm p-8 space-y-6"
                >
                    <div className="flex items-center gap-3 mb-4">
                        <User className="h-6 w-6 text-[#FF0000]" />
                        <h2 className="text-xl font-bold">Perfil</h2>
                    </div>

                    {/* Email (Read-only) */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Email</label>
                        <input
                            type="email"
                            value={user?.email || ''}
                            disabled
                            className="w-full px-4 py-2 border rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                        />
                        <p className="text-xs text-muted-foreground">
                            O email não pode ser alterado
                        </p>
                    </div>

                    {/* Display Name */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Nome de Exibição</label>
                        <input
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF0000]"
                            placeholder="Como você quer ser chamado?"
                        />
                    </div>

                    {/* Save Button */}
                    <button
                        onClick={handleSaveProfile}
                        disabled={saving}
                        className="w-full px-6 py-3 bg-[#FF0000] text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {saving ? (
                            <>
                                <Loader2 className="h-5 w-5 animate-spin" />
                                Salvando...
                            </>
                        ) : (
                            <>
                                <Save className="h-5 w-5" />
                                Salvar Perfil
                            </>
                        )}
                    </button>
                </motion.div>

                {/* Password Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white rounded-xl border shadow-sm p-8 space-y-6"
                >
                    <div className="flex items-center gap-3 mb-4">
                        <Lock className="h-6 w-6 text-[#FF0000]" />
                        <h2 className="text-xl font-bold">Segurança</h2>
                    </div>

                    {/* New Password */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Nova Senha</label>
                        <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF0000]"
                            placeholder="Mínimo 6 caracteres"
                        />
                    </div>

                    {/* Confirm Password */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Confirmar Nova Senha</label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF0000]"
                            placeholder="Digite a senha novamente"
                        />
                    </div>

                    {/* Change Password Button */}
                    <button
                        onClick={handleChangePassword}
                        disabled={changingPassword || !newPassword || !confirmPassword}
                        className="w-full px-6 py-3 bg-[#FF0000] text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {changingPassword ? (
                            <>
                                <Loader2 className="h-5 w-5 animate-spin" />
                                Alterando...
                            </>
                        ) : (
                            <>
                                <Lock className="h-5 w-5" />
                                Alterar Senha
                            </>
                        )}
                    </button>
                </motion.div>
            </div>
        </div>
    );
}
