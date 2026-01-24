import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { LoginPage } from './components/auth/LoginPage';
import { SignUpPage } from './components/auth/SignUpPage';
import { Dashboard } from './components/Dashboard';
import { FilesPage } from './components/FilesPage';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { StudioIndex } from './components/Studio';
import { MainLayout } from './components/MainLayout';
import { SettingsPage } from './components/SettingsPage';
import { PromptMasterPage } from './components/PromptMasterPage';
import ImageTestPage from './components/ImageTestPage';

export default function App() {
    return (
        <AuthProvider>
            <Router>
                <Routes>
                    {/* Public Routes */}
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/signup" element={<SignUpPage />} />

                    {/* Protected Routes with Sidebar Layout */}
                    <Route
                        element={
                            <ProtectedRoute>
                                <MainLayout />
                            </ProtectedRoute>
                        }
                    >
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/studio" element={<StudioIndex />} />
                        <Route path="/files" element={<FilesPage />} />
                        <Route path="/settings" element={<SettingsPage />} />
                        <Route path="/prompt-master" element={<PromptMasterPage />} />
                        <Route path="/image-test" element={<ImageTestPage />} />
                    </Route>

                    {/* Default redirect */}
                    <Route path="/" element={<Navigate to="/login" replace />} />
                </Routes>
            </Router>
        </AuthProvider>
    );
}
