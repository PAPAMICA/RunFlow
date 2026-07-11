"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearToken } from "@/lib/api";

const nav = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/jobs", label: "Jobs" },
  { href: "/workflows", label: "Workflows" },
  { href: "/runs", label: "Runs" },
  { href: "/triggers", label: "Triggers" },
  { href: "/workers", label: "Workers" },
  { href: "/secrets", label: "Secrets" },
  { href: "/credentials", label: "Credentials" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  function logout() {
    clearToken();
    router.push("/login");
  }

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 border-r border-border p-4 flex flex-col">
        <h1 className="text-lg font-bold mb-8">RunFlow</h1>
        <nav className="flex-1 space-y-1">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-3 py-2 rounded text-sm ${
                pathname.startsWith(item.href) ? "bg-primary/20 text-primary" : "hover:bg-card"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <button onClick={logout} className="text-sm text-muted hover:text-foreground mt-4">
          Déconnexion
        </button>
      </aside>
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  );
}
