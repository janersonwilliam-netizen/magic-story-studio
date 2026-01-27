import React from 'react';
import { SignUpForm } from './SignUpForm';
import { Link } from 'react-router-dom';

export function SignUpPage() {
    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary to-orange-600 rounded-2xl mb-4 shadow-lg">
                        <span className="text-white font-bold text-2xl">M</span>
                    </div>
                    <h1 className="text-3xl font-bold text-foreground mb-2">Magic Story Studio</h1>
                    <p className="text-muted-foreground">Crie sua conta gratuitamente</p>
                </div>

                {/* SignUp Form */}
                <div className="bg-card rounded-2xl shadow-xl border border-border p-8">
                    <SignUpForm />

                    <div className="mt-6 text-center">
                        <p className="text-sm text-muted-foreground">
                            Já tem uma conta?{' '}
                            <Link to="/login" className="text-primary hover:text-primary/80 font-medium">
                                Entrar
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
