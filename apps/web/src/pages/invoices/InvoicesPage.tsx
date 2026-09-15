import type { InvoiceStatus } from '@eterna/shared'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { StatusBadge } from '../../components/StatusBadge'
import { useInvoices } from '../../invoices/useInvoices'
import { formatMoney } from '../../lib/money'

const PAGE_SIZE = 10
const STATUS_OPTIONS: Array<InvoiceStatus | 'ALL'> = ['ALL', 'DRAFT', 'ISSUED', 'PAID', 'CANCELLED']

export function InvoicesPage() {
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<InvoiceStatus | 'ALL'>('ALL')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')

  const { data, isLoading, isError, isFetching } = useInvoices({
    page,
    pageSize: PAGE_SIZE,
    status: status === 'ALL' ? undefined : status,
    search: search || undefined,
  })

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    setPage(1)
    setSearch(searchInput.trim())
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Invoices</h1>
        <Link
          to="/invoices/new"
          className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          Create invoice
        </Link>
      </div>

      <form onSubmit={handleSearchSubmit} className="mb-4 flex gap-2">
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by customer or invoice number"
          className="w-full max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          Search
        </button>
      </form>

      <div className="mb-4 flex gap-2">
        {STATUS_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => {
              setStatus(option)
              setPage(1)
            }}
            className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
              status === option
                ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                : 'border-gray-300 text-gray-700 hover:bg-gray-100'
            }`}
          >
            {option === 'ALL' ? 'All' : option}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-gray-500">Loading invoices…</p>}
      {isError && <p className="text-red-600">Failed to load invoices. Please try again.</p>}

      {data && (
        <>
          {data.data.length === 0 ? (
            <p className="text-gray-500">
              {search ? `No invoices match "${search}".` : 'No invoices found.'}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-200 bg-gray-50 text-gray-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">Invoice #</th>
                    <th className="px-4 py-2 font-medium">Customer</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 font-medium">Total</th>
                    <th className="px-4 py-2 font-medium">Issue date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.data.map((invoice) => (
                    <tr key={invoice.id} className="cursor-pointer hover:bg-gray-50">
                      <td className="px-4 py-2">
                        <Link to={`/invoices/${invoice.id}`} className="font-mono text-indigo-600 hover:underline">
                          {invoice.invoiceNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-gray-900">{invoice.customerName}</td>
                      <td className="px-4 py-2">
                        <StatusBadge status={invoice.status} />
                      </td>
                      <td className="px-4 py-2 text-gray-700">{formatMoney(invoice.total)}</td>
                      <td className="px-4 py-2 text-gray-500">
                        {new Date(invoice.issueDate).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
            <span>
              Page {data.meta.page} of {data.meta.totalPages} ({data.meta.total} total)
              {isFetching && ' · updating…'}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-md border border-gray-300 px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= data.meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-md border border-gray-300 px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
