import React from 'react';
import { SignUpForm } from './SignUpForm';
import { Link } from 'react-router-dom';

export function SignUpPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl mb-4 shadow-lg">
                        <span className="text-white font-bold text-2xl">M</span>
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Magic Story Studio</h1>
                    <p className="text-gray-600">Crie sua conta gratuitamente</p>
                </div>

                {/* SignUp Form */}
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
                    <SignUpForm />

                    <div className="mt-6 text-center">
                        <p className="text-sm text-gray-600">
                            Já tem uma conta?{' '}
                            <Link to="/login" className="text-red-600 hover:text-red-700 font-medium">
                                Entrar
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
