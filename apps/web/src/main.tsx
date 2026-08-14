/**
 * Web 入口：挂载 React 应用，并统一提供 React Query 与路由上下文。
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./app/App";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import "./styles.css";

document.documentElement.dataset.theme =
  localStorage.getItem("agent-console-theme") ?? "dark";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 数据默认 5 秒内复用，避免切换页面时重复请求
      staleTime: 5_000,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
