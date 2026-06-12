import { useAuth } from "../hooks/useAuth";

export function Dashboard() {
  const { user, signOut } = useAuth();
  return (
    <div>
      <h1>LeeView Dashboard</h1>
      <p>Welcome, {user?.email}</p>
      <button onClick={signOut}>Sign Out</button>
    </div>
  );
}
