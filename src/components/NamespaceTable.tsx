'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

interface Namespace {
  name: string
  shutdownBy: string
  shutdownAt: string
  annotations: Record<string, string>
  labelValue: string | null
}

export default function NamespaceTable() {
  const { data: session } = useSession()
  const [namespaces, setNamespaces] = useState<Namespace[]>([])
  const [targetLabelName, setTargetLabelName] = useState<string | null>(null)
  const [shutdownDays, setShutdownDays] = useState<number>(7)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [extending, setExtending] = useState<string | null>(null)

  useEffect(() => {
    fetchNamespaces()
  }, [])

  const fetchNamespaces = async () => {
    try {
      const response = await fetch('/api/namespaces')
      if (!response.ok) {
        throw new Error('Failed to fetch namespaces')
      }
      const data = await response.json()
      setNamespaces(data.namespaces)
      setTargetLabelName(data.targetLabelName)
      setShutdownDays(data.shutdownDays || 7)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  // Helper function to check if shutdown date is within 3 days
  const isShutdownSoon = (shutdownAt: string) => {
    if (!shutdownAt) return false
    const shutdownDate = new Date(shutdownAt)
    const now = new Date()
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
    return shutdownDate <= threeDaysFromNow
  }

  const handleExtend = async (namespaceName: string) => {
    if (!session?.user?.email) {
      setError('Must be logged in to extend namespace')
      return
    }

    setExtending(namespaceName)
    try {
      const response = await fetch(`/api/namespaces/${namespaceName}/extend`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Failed to extend namespace')
      }

      const data = await response.json()
      
      // Update the namespace in local state
      setNamespaces(prev => prev.map(ns => 
        ns.name === namespaceName 
          ? { ...ns, shutdownAt: data.shutdownAt, shutdownBy: data.shutdownBy }
          : ns
      ))
      
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extend namespace')
    } finally {
      setExtending(null)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-md">
        <p className="text-red-800">Error: {error}</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-white border border-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Namespace Name
            </th>
            {targetLabelName && (
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {targetLabelName}
              </th>
            )}
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Shutdown At
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Shutdown By
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {namespaces.map((namespace) => (
            <tr key={namespace.name} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                {namespace.name}
              </td>
              {targetLabelName && (
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {namespace.labelValue || '-'}
                  </span>
                </td>
              )}
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                {namespace.shutdownAt ? (
                  <span className={`font-medium ${isShutdownSoon(namespace.shutdownAt) ? 'text-red-600' : 'text-gray-900'}`}>
                    {namespace.shutdownAt}
                  </span>
                ) : (
                  <span className="text-gray-400 italic">
                    {new Date(Date.now() + shutdownDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                  </span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {namespace.shutdownBy || '-'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <button 
                  onClick={() => handleExtend(namespace.name)}
                  disabled={extending === namespace.name}
                  className="text-blue-600 hover:text-blue-900 disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                  {extending === namespace.name ? 'Extending...' : 'Extend'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}