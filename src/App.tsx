import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Success from "./pages/Success";
import Cancel from "./pages/Cancel";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Vite sets BASE_URL to the `base` value in vite.config.ts.
// In production: "/solicitar-recogida/formulario/"
// In development: "/"
// React Router basename must not have a trailing slash.
const basename = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter basename={basename}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/success" element={<Success />} />
          <Route path="/cancel" element={<Cancel />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
