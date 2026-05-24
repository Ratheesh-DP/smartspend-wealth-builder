import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import Index from "./pages/Index";
import Transactions from "./pages/Transactions";
import Budget from "./pages/Budget";
import Insights from "./pages/Insights";
import Investments from "./pages/Investments";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AppLayout><Index /></AppLayout>} />
          <Route path="/transactions" element={<AppLayout><Transactions /></AppLayout>} />
          <Route path="/budget" element={<AppLayout><Budget /></AppLayout>} />
          <Route path="/insights" element={<AppLayout><Insights /></AppLayout>} />
          <Route path="/investments" element={<AppLayout><Investments /></AppLayout>} />
          <Route path="/settings" element={<AppLayout><SettingsPage /></AppLayout>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
