import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/lib/auth-context";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Pages
import { LandingPage } from "@/pages/LandingPage";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { WelcomePage } from "@/pages/WelcomePage";
import { DashboardHome } from "@/pages/dashboard/DashboardHome";
import { AnalysisPage } from "@/pages/dashboard/AnalysisPage";
import { MapPage } from "@/pages/dashboard/MapPage";
import { SettingsPage } from "@/pages/dashboard/SettingsPage";
import { AboutPage } from "@/pages/dashboard/AboutPage";
import { RequestsPage } from "@/pages/dashboard/RequestsPage";
import { AppointmentsPage } from "@/pages/dashboard/AppointmentsPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
    <QueryClientProvider client={queryClient}>
        <AuthProvider>
            <TooltipProvider>
                <Toaster />
                <Sonner />
                <ErrorBoundary>
                    <BrowserRouter>
                        <Routes>
                            {/* Public Routes */}
                            <Route path="/" element={<LandingPage />} />
                            <Route path="/login" element={<LoginPage />} />
                            <Route path="/register" element={<RegisterPage />} />

                            {/* Welcome Screen */}
                            <Route
                                path="/welcome"
                                element={
                                    <ProtectedRoute>
                                        <WelcomePage />
                                    </ProtectedRoute>
                                }
                            />

                            {/* Dashboard Routes */}
                            <Route
                                path="/dashboard"
                                element={
                                    <ProtectedRoute>
                                        <DashboardLayout>
                                            <DashboardHome />
                                        </DashboardLayout>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/dashboard/analysis"
                                element={
                                    <ProtectedRoute>
                                        <DashboardLayout>
                                            <AnalysisPage />
                                        </DashboardLayout>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/dashboard/map"
                                element={
                                    <ProtectedRoute>
                                        <DashboardLayout>
                                            <MapPage />
                                        </DashboardLayout>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/dashboard/settings"
                                element={
                                    <ProtectedRoute>
                                        <DashboardLayout>
                                            <SettingsPage />
                                        </DashboardLayout>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/dashboard/about"
                                element={
                                    <ProtectedRoute>
                                        <DashboardLayout>
                                            <AboutPage />
                                        </DashboardLayout>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/dashboard/requests"
                                element={
                                    <ProtectedRoute>
                                        <DashboardLayout>
                                            <RequestsPage />
                                        </DashboardLayout>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/dashboard/appointments"
                                element={
                                    <ProtectedRoute>
                                        <DashboardLayout>
                                            <AppointmentsPage />
                                        </DashboardLayout>
                                    </ProtectedRoute>
                                }
                            />

                            {/* Catch-all */}
                            <Route path="*" element={<NotFound />} />
                        </Routes>
                    </BrowserRouter>
                </ErrorBoundary>
            </TooltipProvider>
        </AuthProvider>
    </QueryClientProvider>
);

export default App;
