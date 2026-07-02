import React from 'react';
import { useNavigate } from 'react-router-dom';
import { TestTube, Flower2, Volume2, PenLine, BookOpen, ChevronRight, LucideIcon } from 'lucide-react';

interface TestEntry {
    route: string;
    label: string;
    description: string;
    icon: LucideIcon;
}

const testPages: TestEntry[] = [
    {
        route: '/image-test',
        label: 'Teste de Imagens',
        description: 'Testes de geração de imagens.',
        icon: TestTube,
    },
    {
        route: '/pollinations-test',
        label: 'Teste Pollinations',
        description: 'Testes de geração de imagens via Pollinations.',
        icon: Flower2,
    },
    {
        route: '/narration-test',
        label: 'Teste de Narração',
        description: 'Testes de geração de áudio/narração.',
        icon: Volume2,
    },
    {
        route: '/palito-test',
        label: 'Teste Palito',
        description: 'Testes das histórias em formato palito.',
        icon: PenLine,
    },
    {
        route: '/biblica-test',
        label: 'Teste Bíblico',
        description: 'Testes das histórias bíblicas (capa e cena).',
        icon: BookOpen,
    },
];

export function TestsIndexPage() {
    const navigate = useNavigate();

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-foreground">Páginas de Teste</h1>
                <p className="text-muted-foreground mt-1">
                    Lista de páginas experimentais usadas para testar funcionalidades.
                </p>
            </div>

            <div className="bg-card rounded-xl border border-border shadow-sm divide-y divide-border overflow-hidden">
                {testPages.map((page) => {
                    const Icon = page.icon;
                    return (
                        <button
                            key={page.route}
                            onClick={() => navigate(page.route)}
                            className="w-full flex items-center gap-4 px-6 py-4 hover:bg-secondary/60 transition-colors text-left"
                        >
                            <Icon className="h-5 w-5 flex-shrink-0 text-primary" />
                            <div className="flex-1 min-w-0">
                                <div className="font-medium text-foreground">{page.label}</div>
                                <div className="text-sm text-muted-foreground truncate">{page.description}</div>
                            </div>
                            <ChevronRight className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
