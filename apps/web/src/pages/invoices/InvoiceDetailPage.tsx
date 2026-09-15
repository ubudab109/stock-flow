import { Link, useParams } from 'react-router-dom'
import { StatusBadge } from '../../components/StatusBadge'
import { useCancelInvoice, useInvoice, useIssueInvoice, usePayInvoice } from '../../invoices/useInvoices'
import { API_URL } from '../../lib/api-client'
import { formatMoney } from '../../lib/money'

export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: invoice, isLoading, isError } = useInvoice(id ?? '')
  const issueInvoice = useIssueInvoice()
  const payInvoice = usePayInvoice()
  const cancelInvoice = useCancelInvoice()

  const isActionPending = issueInvoice.isPending || payInvoice.isPending || cancelInvoice.isPending

  const handleAction = (
    mutation: typeof issueInvoice | typeof payInvoice | typeof cancelInvoice,
    confirmMessage?: string,
  ) => {
    if (!id) return
    if (confirmMessage && !window.confirm(confirmMessage)) return
    mutation.mutate(id, {
      onError: (error) => window.alert(error instanceof Error ? error.message : 'Action failed.'),
    })
  }

  if (isLoading) return <p className="text-gray-500">Loading invoice…</p>
  if (isError || !invoice) return <p className="text-red-600">Failed to load this invoice.</p>

  return (
    <div>
      <Link to="/invoices" className="mb-4 inline-block text-sm text-indigo-600 hover:underline">
        ← Back to invoices
      </Link>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-mono text-2xl font-semibold text-gray-900">{invoice.invoiceNumber}</h1>
          <p className="mt-1 text-gray-500">{invoice.customerName}</p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={`${API_URL}/invoices/${invoice.id}/pdf`}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-indigo-600 hover:underline"
          >
            Download PDF
          </a>
          <StatusBadge status={invoice.status} />
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-500">Issue date</span>
          <p className="text-gray-900">{new Date(invoice.issueDate).toLocaleDateString()}</p>
        </div>
        <div>
          <span className="text-gray-500">Due date</span>
          <p className="text-gray-900">{invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : '—'}</p>
        </div>
        {invoice.notes && (
          <div className="col-span-2">
            <span className="text-gray-500">Notes</span>
            <p className="text-gray-900">{invoice.notes}</p>
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-gray-500">
            <tr>
              <th className="px-4 py-2 font-medium">Product</th>
              <th className="px-4 py-2 font-medium">Unit price</th>
              <th className="px-4 py-2 font-medium">Quantity</th>
              <th className="px-4 py-2 font-medium">Line total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {invoice.items.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-2 text-gray-900">{item.productName}</td>
                <td className="px-4 py-2 text-gray-700">{formatMoney(item.unitPrice)}</td>
                <td className="px-4 py-2 text-gray-700">{item.quantity}</td>
                <td className="px-4 py-2 text-gray-700">{formatMoney(item.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 ml-auto flex max-w-xs flex-col gap-1 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Subtotal</span>
          <span className="text-gray-900">{formatMoney(invoice.subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Tax</span>
          <span className="text-gray-900">{formatMoney(invoice.taxAmount)}</span>
        </div>
        <div className="flex justify-between border-t border-gray-200 pt-1 font-semibold">
          <span className="text-gray-900">Total</span>
          <span className="text-gray-900">{formatMoney(invoice.total)}</span>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        {invoice.status === 'DRAFT' && (
          <>
            <button
              type="button"
              disabled={isActionPending}
              onClick={() => handleAction(cancelInvoice)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              Cancel invoice
            </button>
            <button
              type="button"
              disabled={isActionPending}
              onClick={() =>
                handleAction(issueInvoice, 'Issue this invoice? This will decrement stock for its line items.')
              }
              className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              Issue
            </button>
          </>
        )}

        {invoice.status === 'ISSUED' && (
          <>
            <button
              type="button"
              disabled={isActionPending}
              onClick={() =>
                handleAction(cancelInvoice, 'Cancel this issued invoice? This will restore its stock.')
              }
              className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              Cancel invoice
            </button>
            <button
              type="button"
              disabled={isActionPending}
              onClick={() => handleAction(payInvoice)}
              className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              Mark as paid
            </button>
          </>
        )}
      </div>
    </div>
  )
}
