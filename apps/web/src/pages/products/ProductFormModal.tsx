import { zodResolver } from '@hookform/resolvers/zod'
import type { Product } from '@eterna/shared'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { ApiError } from '../../lib/api-client'
import { decimalStringToMinor, minorToDecimalString } from '../../lib/money'
import { useCreateProduct, useUpdateProduct } from '../../products/useProducts'

const productSchema = z.object({
  sku: z.string().min(1, 'SKU is required').max(64),
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(2000).optional(),
  unitPrice: z
    .string()
    .min(1, 'Price is required')
    .refine((v) => !Number.isNaN(Number.parseFloat(v)) && Number.parseFloat(v) >= 0, 'Must be a non-negative number'),
  quantityOnHand: z
    .string()
    .min(1, 'Quantity is required')
    .refine((v) => Number.isInteger(Number(v)) && Number(v) >= 0, 'Must be a non-negative whole number'),
})

type ProductFormValues = z.infer<typeof productSchema>

interface ProductFormModalProps {
  product: Product | null
  onClose: () => void
}

export function ProductFormModal({ product, onClose }: ProductFormModalProps) {
  const isEditing = Boolean(product)
  const createProduct = useCreateProduct()
  const updateProduct = useUpdateProduct()
  const isPending = createProduct.isPending || updateProduct.isPending

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: product
      ? {
          sku: product.sku,
          name: product.name,
          description: product.description ?? '',
          unitPrice: minorToDecimalString(product.unitPrice),
          quantityOnHand: String(product.quantityOnHand),
        }
      : { sku: '', name: '', description: '', unitPrice: '', quantityOnHand: '' },
  })

  const onSubmit = handleSubmit((values) => {
    const payload = {
      sku: values.sku,
      name: values.name,
      description: values.description || undefined,
      unitPrice: decimalStringToMinor(values.unitPrice),
      quantityOnHand: Number(values.quantityOnHand),
    }

    const mutation = isEditing && product ? updateProduct.mutateAsync({ id: product.id, data: payload }) : createProduct.mutateAsync(payload)

    mutation.then(onClose).catch((error: unknown) => {
      const message = error instanceof ApiError ? error.message : 'Something went wrong. Please try again.'
      setError('root', { message })
    })
  })

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          {isEditing ? 'Edit product' : 'Add product'}
        </h2>

        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <div>
            <label htmlFor="sku" className="mb-1 block text-sm font-medium text-gray-700">
              SKU
            </label>
            <input
              id="sku"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              {...register('sku')}
            />
            {errors.sku && <p className="mt-1 text-sm text-red-600">{errors.sku.message}</p>}
          </div>

          <div>
            <label htmlFor="name" className="mb-1 block text-sm font-medium text-gray-700">
              Name
            </label>
            <input
              id="name"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              {...register('name')}
            />
            {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
          </div>

          <div>
            <label htmlFor="description" className="mb-1 block text-sm font-medium text-gray-700">
              Description <span className="text-gray-400">(optional)</span>
            </label>
            <textarea
              id="description"
              rows={2}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              {...register('description')}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="unitPrice" className="mb-1 block text-sm font-medium text-gray-700">
                Unit price
              </label>
              <input
                id="unitPrice"
                type="number"
                step="0.01"
                min="0"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                {...register('unitPrice')}
              />
              {errors.unitPrice && <p className="mt-1 text-sm text-red-600">{errors.unitPrice.message}</p>}
            </div>

            <div>
              <label htmlFor="quantityOnHand" className="mb-1 block text-sm font-medium text-gray-700">
                Quantity on hand
              </label>
              <input
                id="quantityOnHand"
                type="number"
                step="1"
                min="0"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                {...register('quantityOnHand')}
              />
              {errors.quantityOnHand && (
                <p className="mt-1 text-sm text-red-600">{errors.quantityOnHand.message}</p>
              )}
            </div>
          </div>

          {errors.root && <p className="text-sm text-red-600">{errors.root.message}</p>}

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {isPending ? 'Saving…' : isEditing ? 'Save changes' : 'Add product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
