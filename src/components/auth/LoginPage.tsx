import React from 'react';
import { LoginForm } from './LoginForm';
import { Link } from 'react-router-dom';

export function LoginPage() {
    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary to-orange-600 rounded-2xl mb-4 shadow-lg">
                        <span className="text-white font-bold text-2xl">M</span>
                    </div>
                    <h1 className="text-3xl font-bold text-foreground mb-2">Magic Story Studio</h1>
                    <p className="text-muted-foreground">Entre para começar a criar</p>
                </div>

                {/* Login Form */}
                <div className="bg-card rounded-2xl shadow-xl border border-border p-8">
                    <LoginForm />

                    <div className="mt-6 text-center">
                        <p className="text-sm text-muted-foreground">
                            Não tem uma conta?{' '}
                            <Link to="/signup" className="text-primary hover:text-primary/80 font-medium">
                                Cadastre-se
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
