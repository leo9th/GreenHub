import { Outlet } from "react-router";

export function AuthLayout() {
  return (
    <div className="min-h-screen bg-muted flex flex-col">
      <header className="bg-white border-b border-border">
        <div className="px-4 py-3 flex items-center max-w-7xl mx-auto">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#22c55e] flex items-center justify-center">
              <span className="text-white font-bold">G</span>
            </div>
            <span className="font-bold text-lg text-foreground">GreenHub</span>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
