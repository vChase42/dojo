"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMe } from "../hooks/me";
import { useAuth } from "../hooks/useAuth";


export default function Header() {
  const router = useRouter();
  const {data:user, isLoading} = useMe();
  const {login,logout} = useAuth();



  // Logout handler
  async function handleLogout() {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });

    logout.mutateAsync();
    
  }

  return (
    <header className="w-full p-4 shadow bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        
        <Link href="/" className="text-xl font-bold">
          dojo
        </Link>
        <Link href="/threads">Threads</Link>


        <nav className="flex gap-4 text-sm items-center">
          
          {/* Loading state prevents flicker */}
          {isLoading ? (
            <span className="opacity-50">...</span>
          ) : user ? (
            <>
              <span className="font-medium">{user.username}</span>
              <button
                onClick={handleLogout}
                className="text-red-500 hover:underline"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link href="/login">Login</Link>
              <Link href="/register">Signup</Link>
            </>
          )}
        </nav>

      </div>
    </header>
  );
}
