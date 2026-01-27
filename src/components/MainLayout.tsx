import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Menu, X } from 'lucide-react';

type PageType = 'stories' | 'prompt-master' | 'settings' | 'image-test' | 'studio' | 'files';

// Map routes to page IDs
const routeToPage: Record<string, PageType> = {
    '/dashboard': 'stories',
    '/studio': 'studio',
    '/files': 'files',
    '/settings': 'settings',
    '/prompt-master': 'prompt-master',
    '/image-test': 'image-test',
};

// Map page IDs to routes
const pageToRoute: Record<PageType, string> = {
    'stories': '/dashboard',
    'studio': '/studio',
    'files': '/files',
    'settings': '/settings',
    'prompt-master': '/prompt-master',
    'image-test': '/image-test',
};

export function MainLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    // Determine current page from route
    const currentPage = routeToPage[location.pathname] || 'stories';

    const handleNavigate = (page: PageType) => {
        const route = pageToRoute[page];
        if (route) {
            navigate(route);
        }
    };

    // Get search params to check if we're in the timeline editor
    const searchParams = new URLSearchParams(location.search);
    const currentStep = searchParams.get('step');

    // Hide sidebar only when in TIMELINE or EDITOR step (full-screen editor modes)
    const isEditorMode = location.pathname === '/studio' &&
        (currentStep === 'TIMELINE' || currentStep === 'EDITOR');

    return (
        <div
            className={`flex w-full h-full min-h-screen ${isEditorMode ? 'bg-background overflow-hidden' : 'bg-background overflow-auto'}`}
            data-editor-mode={isEditorMode ? "true" : "false"}
        >
            {/* Hide sidebar and toggle button in editor mode */}
            {!isEditorMode && (
                <>
                    {/* Sidebar Toggle Button (Mobile) */}
                    <button
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="fixed top-4 left-4 z-50 p-2 bg-card text-foreground rounded-lg lg:hidden hover:bg-accent transition-colors"
                    >
                        {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                    </button>

                    {/* Sidebar */}
                    <div className={`
                        fixed lg:relative inset-y-0 left-0 z-40
                        transform transition-transform duration-300 ease-in-out
                        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
                    `}>
                        <Sidebar
                            currentPage={currentPage as any}
                            onNavigate={handleNavigate as any}
                            isOpen={isSidebarOpen}
                        />
                    </div>

                    {/* Backdrop for mobile */}
                    {isSidebarOpen && (
                        <div
                            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
                            onClick={() => setIsSidebarOpen(false)}
                        />
                    )}
                </>
            )}

            {/* Main Content */}
            <main className={`flex-1 w-full h-full ${isEditorMode ? 'bg-background p-0' : 'bg-background p-6 lg:p-8 overflow-auto'}`}>
                <Outlet />
            </main>
        </div>
    );
}
