import { useAuth } from "../hooks/useAuth";
import { InterviewList } from "../components/InterviewList";

export function Dashboard() {
  const { user, signOut } = useAuth();
  return (
    <div className="min-h-screen p-8 max-w-6xl mx-auto">
      <header className="flex justify-between items-center mb-8">
        <h1 className="font-sans text-2xl font-medium text-textPrimary">LeeView</h1>
        <div className="flex items-center gap-4">
          <span className="text-xs font-mono text-textSecondary">{user?.email}</span>
          <button
            onClick={signOut}
            className="px-4 py-2 rounded-pill bg-bgPanel border border-borderGlass text-textPrimary text-xs font-mono hover:bg-bgPanelInner transition-colors"
          >
            Sign Out
          </button>
        </div>
      </header>
      <main>
        <InterviewList />
      </main>
    </div>
  );
}
