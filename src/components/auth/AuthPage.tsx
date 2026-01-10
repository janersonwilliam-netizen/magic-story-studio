import React, { useState } from 'react';
import { LoginForm } from './LoginForm';
import { SignUpForm } from './SignUpForm';

export function AuthPage() {
    const [isLogin, setIsLogin] = useState(true);

    return (
        <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[#0f0f0f]">
            <div className="w-full max-w-md">
                {isLogin ? <LoginForm /> : <SignUpForm />}

                <div className="text-center mt-6">
                    <button
                        onClick={() => setIsLogin(!isLogin)}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                        {isLogin ? (
                            <>
                                Não tem uma conta?{' '}
                                <span className="font-medium text-primary">Criar conta</span>
                            </>
                        ) : (
                            <>
                                Já tem uma conta?{' '}
                                <span className="font-medium text-primary">Entrar</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
