import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppProvider } from "@/contexts/AppContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Home from "./pages/Home";
import SearchPage from "./pages/SearchPage";
import GifDetail from "./pages/GifDetail";
import CreateGif from "./pages/CreateGif";
import CameraCapture from "./pages/CameraCapture";
import Favorites from "./pages/Favorites";
import Profile from "./pages/Profile";
import Collections from "./pages/Collections";
import EmbedPicker from "./pages/EmbedPicker";
import IntegrationDemo from "./pages/IntegrationDemo";
import Discover from "./pages/Discover";
import PublicProfile from "./pages/PublicProfile";
import PickerKeys from "./pages/PickerKeys";
import IntegrationStatus from "./pages/IntegrationStatus";
import AuthRoute from "./pages/AuthRoute";
import AuthCallback from "./pages/AuthCallback";
import TreyTvCallback from "./pages/TreyTvCallback";
import TreyTvStart from "./pages/TreyTvStart";
import PickerKeyManager from "./pages/PickerKeyManager";
import Feed from "./pages/Feed";
import PasswordReset from "./pages/PasswordReset";
import FwdShare from "./pages/FwdShare";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider defaultTheme="dark">
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <AuthProvider>
            <AppProvider>
              <Toaster />
              <Sonner />
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/home" element={<Home />} />
                <Route path="/login" element={<AuthRoute mode="signin" />} />
                <Route path="/signup" element={<AuthRoute mode="signup" />} />
                <Route path="/forgot-password" element={<PasswordReset mode="request" />} />
                <Route path="/reset-password" element={<PasswordReset mode="reset" />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/auth/trey-tv/start" element={<TreyTvStart />} />
                <Route path="/auth/trey-tv/callback" element={<TreyTvCallback />} />
                <Route path="/create-profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/gif/:id" element={<GifDetail />} />
                <Route path="/create" element={<ProtectedRoute><CreateGif /></ProtectedRoute>} />
                <Route path="/camera" element={<ProtectedRoute><CameraCapture /></ProtectedRoute>} />
                <Route path="/favorites" element={<ProtectedRoute><Favorites /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                <Route path="/collections" element={<ProtectedRoute><Collections /></ProtectedRoute>} />
                <Route path="/embed/picker" element={<EmbedPicker />} />
                <Route path="/demo" element={<IntegrationDemo />} />
                <Route path="/discover" element={<Discover />} />
                <Route path="/u/:username" element={<PublicProfile />} />
                <Route path="/settings/picker-keys" element={<ProtectedRoute><PickerKeys /></ProtectedRoute>} />
                <Route path="/picker-api-keys" element={<ProtectedRoute><PickerKeys /></ProtectedRoute>} />
                <Route path="/integration-status" element={<IntegrationStatus />} />
                <Route path="/feed" element={<ProtectedRoute><Feed /></ProtectedRoute>} />
                <Route path="/f/:id" element={<FwdShare />} />
                <Route path="/settings/integrations" element={<ProtectedRoute><PickerKeyManager /></ProtectedRoute>} />
                <Route path="*" element={<NotFound />} />

              </Routes>
            </AppProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
