'use client'

import { useState, useEffect } from 'react'
import NamespaceTable from '@/components/NamespaceTable'
import AuthGuard from '@/components/AuthGuard'
import Header from '@/components/Header'

export default function Home() {
  const [shutdownDays, setShutdownDays] = useState<number | null>(null)

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch('/api/namespaces')
        if (response.ok) {
          const data = await response.json()
          setShutdownDays(data.shutdownDays || 7)
        }
      } catch (error) {
        console.error('Failed to fetch configuration:', error)
        setShutdownDays(7) // Fallback to default
      }
    }

    fetchConfig()
  }, [])

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Kubernetes Namespaces</h1>
            <p className="mt-2 text-sm text-gray-600">
              Each namespace shows the next scheduled shutdown date. Clicking <strong>Extend</strong> button resets the date to {shutdownDays ? `${shutdownDays} days` : 'the configured number of days'} from now.
            </p>
          </div>
          
          <div className="bg-white shadow rounded-lg">
            <NamespaceTable />
          </div>
        </div>
      </div>
    </AuthGuard>
  )
}
