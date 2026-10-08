import { Link } from "@tanstack/react-router";
import { Activity, ArrowUpRight, ChartNoAxesCombined, FileUp, History, Sparkles } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";

import { useDashboardData } from "@/lib/dashboard-data";

type DashboardShellProps = {
  activeView: "overview" | "answers" | "upload" | "runs";
  children: ReactNode;
};

const navigation = [
  { id: "overview", label: "Overview", icon: ChartNoAxesCombined, to: "/" as const },
  { id: "answers", label: "Answer Explorer", icon: Activity, to: "/answer-explorer" as const },
  { id: "upload", label: "Upload & Analyze", icon: FileUp, to: "/upload" as const },
  { id: "runs", label: "Upload History", icon: History, to: "/runs" as const },
];

export function DashboardShell({ activeView, children }: DashboardShellProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const dashboardState = useDashboardData();
  const dashboardData = dashboardState.status === "ready" ? dashboardState.data : null;

  return (
    <div className="dashboard-wash min-h-screen px-3 py-3 sm:px-5 sm:py-5 xl:px-7">
      <div
        className={`dashboard-layout mx-auto grid w-full max-w-[1800px] gap-4 sm:gap-5 ${isExpanded ? "dashboard-layout-expanded" : "dashboard-layout-collapsed"}`}
      >
        <aside
          id="dashboard-sidebar"
          className={`dashboard-sidebar glass-surface-strong flex flex-col rounded-2xl p-3 ${isExpanded ? "dashboard-sidebar-expanded" : "dashboard-sidebar-collapsed"}`}
        >
          <div className="dashboard-brand-row flex min-w-0 items-center justify-between gap-2">
            <button
              type="button"
              aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
              aria-expanded={isExpanded}
              aria-controls="dashboard-sidebar"
              title={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
              onClick={() => setIsExpanded((expanded) => !expanded)}
              className="dashboard-brand dashboard-brand-toggle flex min-w-0 items-center gap-3 rounded-xl p-1.5 text-left text-foreground hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <Sparkles aria-hidden="true" className="size-[18px]" />
              </span>
              <span className="dashboard-brand-copy min-w-0">
                <span className="block truncate font-display text-base font-bold leading-tight">
                  Corvane Fleet
                </span>
                <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  AI visibility
                </span>
              </span>
            </button>
          </div>
          <div className="nav-section-label mt-6 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Workspace
          </div>
          <nav aria-label="Main navigation" className="dashboard-nav mt-2 flex flex-col gap-1.5">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = item.id === activeView;
              return (
                <Link
                  key={item.id}
                  to={item.to}
                  aria-label={item.label}
                  aria-current={isActive ? "page" : undefined}
                  title={!isExpanded ? item.label : undefined}
                  className={`nav-link ${isActive ? "nav-link-active" : ""}`}
                >
                  <Icon aria-hidden="true" className="size-[18px] shrink-0" />
                  <span className="nav-label">{item.label}</span>
                  {isActive && (
                    <ArrowUpRight aria-hidden="true" className="nav-current ml-auto size-4" />
                  )}
                </Link>
              );
            })}
          </nav>
          <div className="dashboard-sidebar-footer mt-auto border-t border-border/80 pt-4">
            <div className="sidebar-footer-content">
              {dashboardData ? (
                <div className="rounded-xl bg-muted/70 p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-foreground">
                      {dashboardData.period} coverage
                    </span>
                    <span
                      className={`size-2 shrink-0 rounded-full ${dashboardData.coverage.status === "complete" ? "bg-positive" : "bg-warning"}`}
                      aria-label={
                        dashboardData.coverage.status === "complete"
                          ? "Complete week"
                          : "Partial week"
                      }
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                    {dashboardData.coverage.validSlots} of {dashboardData.coverage.expectedSlots}{" "}
                    response slots · {Math.round(dashboardData.coverage.coverage * 100)}% complete
                  </p>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-card">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{
                        width: `${dashboardData.coverage.coverage * 100}%`,
                      }}
                    />
                  </div>
                  {dashboardData.partialWeeks.length > 0 && (
                    <p className="mt-2 text-[10px] leading-relaxed text-warning">
                      Partial data in{" "}
                      {dashboardData.partialWeeks.map((week) => `Week ${week.week}`).join(", ")}.
                    </p>
                  )}
                </div>
              ) : (
                <div className="rounded-xl bg-muted/70 p-3.5 text-[11px] text-muted-foreground">
                  {dashboardState.status === "error"
                    ? "Pipeline data unavailable"
                    : "Loading pipeline coverage…"}
                </div>
              )}
              <p className="mt-3 px-1 text-[10px] leading-relaxed text-muted-foreground">
                Pipeline generated data
              </p>
            </div>
          </div>
        </aside>
        <main className="min-w-0 lg:py-1" id="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
