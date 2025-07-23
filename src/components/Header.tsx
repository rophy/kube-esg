'use client'

import { useSession, signOut } from 'next-auth/react'

export default function Header() {
  const { data: session } = useSession()

  const handleSignOut = () => {
    signOut({ callbackUrl: '/login' })
  }

  if (!session) return null

  return (
    <header className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              Kubernetes ESG Dashboard
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-700">
              Welcome, {session.user?.name || session.user?.email}
            </span>
            <button
              onClick={handleSignOut}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}