import { zodResolver } from '@hookform/resolvers/zod'
import { useFieldArray, useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { useCreateInvoice } from '../../invoices/useInvoices'
import { ApiError } from '../../lib/api-client'
import { formatMoney } from '../../lib/money'
import { useProducts } from '../../products/useProducts'

const invoiceSchema = z.object({
  customerName: z.string().min(1, 'Customer name is required').max(200),
  dueDate: z.string().optional(),
  notes: z.string().max(2000).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1, 'Select a product'),
        quantity: z
          .string()
          .min(1, 'Required')
          .refine((v) => Number.isInteger(Number(v)) && Number(v) > 0, 'Must be a positive whole number'),
      }),
    )
    .min(1, 'Add at least one line item'),
})

type InvoiceFormValues = z.infer<typeof invoiceSchema>

export function InvoiceCreatePage() {
  const navigate = useNavigate()
  const createInvoice = useCreateInvoice()
  const { data: productsPage } = useProducts({ page: 1, pageSize: 100, search: '' })
  const products = productsPage?.data ?? []

  const {
    register,
    control,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: { customerName: '', dueDate: '', notes: '', items: [{ productId: '', quantity: '1' }] },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const watchedItems = watch('items')

  const preview = watchedItems.reduce(
    (acc, item) => {
      const product = products.find((p) => p.id === item.productId)
      const quantity = Number(item.quantity) || 0
      if (product && quantity > 0) {
        acc.subtotal += product.unitPrice * quantity
      }
      return acc
    },
    { subtotal: 0 },
  )

  const onSubmit = handleSubmit((values) => {
    createInvoice.mutate(
      {
        customerName: values.customerName,
        dueDate: values.dueDate || undefined,
        notes: values.notes || undefined,
        items: values.items.map((item) => ({ productId: item.productId, quantity: Number(item.quantity) })),
      },
      {
        onSuccess: (invoice) => navigate(`/invoices/${invoice.id}`),
        onError: (error) => {
          const message = error instanceof ApiError ? error.message : 'Something went wrong. Please try again.'
          setError('root', { message })
        },
      },
    )
  })

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">Create invoice</h1>

      <form onSubmit={onSubmit} className="flex max-w-2xl flex-col gap-4" noValidate>
        <div>
          <label htmlFor="customerName" className="mb-1 block text-sm font-medium text-gray-700">
            Customer name
          </label>
          <input
            id="customerName"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            {...register('customerName')}
          />
          {errors.customerName && <p className="mt-1 text-sm text-red-600">{errors.customerName.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="dueDate" className="mb-1 block text-sm font-medium text-gray-700">
              Due date <span className="text-gray-400">(optional)</span>
            </label>
            <input
              id="dueDate"
              type="date"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              {...register('dueDate')}
            />
          </div>
          <div>
            <label htmlFor="notes" className="mb-1 block text-sm font-medium text-gray-700">
              Notes <span className="text-gray-400">(optional)</span>
            </label>
            <input
              id="notes"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              {...register('notes')}
            />
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Line items</span>
            <button
              type="button"
              onClick={() => append({ productId: '', quantity: '1' })}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
            >
              + Add line
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {fields.map((field, index) => (
              <div key={field.id} className="flex items-start gap-2">
                <select
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  {...register(`items.${index}.productId` as const)}
                >
                  <option value="">Select a product…</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} ({product.sku}) — {formatMoney(product.unitPrice)}, {product.quantityOnHand} in
                      stock
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  step="1"
                  className="w-24 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  {...register(`items.${index}.quantity` as const)}
                />
                <button
                  type="button"
                  onClick={() => remove(index)}
                  disabled={fields.length === 1}
                  className="px-2 py-2 text-sm font-medium text-red-600 hover:text-red-500 disabled:opacity-30"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          {errors.items?.message && <p className="mt-1 text-sm text-red-600">{errors.items.message}</p>}
          {errors.items?.root?.message && <p className="mt-1 text-sm text-red-600">{errors.items.root.message}</p>}
        </div>

        <div className="rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
          <p>Estimated subtotal: {formatMoney(preview.subtotal)}</p>
          <p className="mt-1 text-gray-500">
            Final tax and total are calculated by the server when the invoice is created.
          </p>
        </div>

        {errors.root && <p className="text-sm text-red-600">{errors.root.message}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="submit"
            disabled={createInvoice.isPending}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {createInvoice.isPending ? 'Creating…' : 'Create invoice'}
          </button>
        </div>
      </form>
    </div>
  )
}
