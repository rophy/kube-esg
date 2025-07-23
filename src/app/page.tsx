import NamespaceTable from '@/components/NamespaceTable'
import AuthGuard from '@/components/AuthGuard'
import Header from '@/components/Header'

export default function Home() {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Kubernetes Namespaces</h1>
            <p className="mt-2 text-sm text-gray-600">
              Manage and monitor your Kubernetes namespaces
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
