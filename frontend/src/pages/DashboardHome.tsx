import { useFrappeAuth } from "frappe-react-sdk";

export default function DashboardHome() {
  const { currentUser } = useFrappeAuth();

  return (
    <div className="flex flex-col gap-2">
      <h1 className="font-serif text-2xl font-bold text-foreground">Welcome back{currentUser ? `, ${currentUser}` : ""}</h1>
      <p className="text-sm text-muted-foreground">
        Use the sidebar or press <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">Ctrl K</kbd> to jump
        to any screen.
      </p>
    </div>
  );
}
