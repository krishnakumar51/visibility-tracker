import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";

import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "@fontsource/space-grotesk/latin-500.css";
import "@fontsource/space-grotesk/latin-600.css";
import "@fontsource/space-grotesk/latin-700.css";
import { getRouter } from "./router";
import "./styles.css";
import { DashboardDataProvider } from "./lib/dashboard-data";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error('Root element "#root" was not found');

createRoot(rootElement).render(
  <StrictMode>
    <DashboardDataProvider>
      <RouterProvider router={getRouter()} />
    </DashboardDataProvider>
  </StrictMode>,
);
