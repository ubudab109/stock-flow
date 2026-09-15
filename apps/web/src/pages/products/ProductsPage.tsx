import type { Product } from '@eterna/shared'
import { useState } from 'react'
import { formatMoney } from '../../lib/money'
import { useDeleteProduct, useProducts } from '../../products/useProducts'
import { ProductFormModal } from './ProductFormModal'

const PAGE_SIZE = 10

export function ProductsPage() {
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  const { data, isLoading, isError, isFetching } = useProducts({ page, pageSize: PAGE_SIZE, search })
  const deleteProduct = useDeleteProduct()

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    setPage(1)
    setSearch(searchInput.trim())
  }

  const handleDelete = (product: Product) => {
    if (!window.confirm(`Delete "${product.name}"? This cannot be undone.`)) {
      return
    }
    deleteProduct.mutate(product.id, {
      onError: (error) => {
        window.alert(error instanceof Error ? error.message : 'Failed to delete product.')
      },
    })
  }

  const showModal = isCreating || editingProduct !== null
  const closeModal = () => {
    setIsCreating(false)
    setEditingProduct(null)
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Products</h1>
        <button
          type="button"
          onClick={() => setIsCreating(true)}
          className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          Add product
        </button>
      </div>

      <form onSubmit={handleSearchSubmit} className="mb-4 flex gap-2">
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by name or SKU"
          className="w-full max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          Search
        </button>
      </form>

      {isLoading && <p className="text-gray-500">Loading products…</p>}
      {isError && <p className="text-red-600">Failed to load products. Please try again.</p>}

      {data && (
        <>
          {data.data.length === 0 ? (
            <p className="text-gray-500">
              {search ? `No products match "${search}".` : 'No products yet — add your first one above.'}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-200 bg-gray-50 text-gray-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">SKU</th>
                    <th className="px-4 py-2 font-medium">Name</th>
                    <th className="px-4 py-2 font-medium">Unit price</th>
                    <th className="px-4 py-2 font-medium">Qty on hand</th>
                    <th className="px-4 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.data.map((product) => (
                    <tr key={product.id}>
                      <td className="px-4 py-2 font-mono text-gray-700">{product.sku}</td>
                      <td className="px-4 py-2 text-gray-900">{product.name}</td>
                      <td className="px-4 py-2 text-gray-700">{formatMoney(product.unitPrice)}</td>
                      <td className="px-4 py-2 text-gray-700">{product.quantityOnHand}</td>
                      <td className="px-4 py-2">
                        <button
                          type="button"
                          onClick={() => setEditingProduct(product)}
                          className="mr-3 font-medium text-indigo-600 hover:text-indigo-500"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(product)}
                          className="font-medium text-red-600 hover:text-red-500"
                        >
                          Delete
                        </button>
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

      {showModal && <ProductFormModal product={editingProduct} onClose={closeModal} />}
    </div>
  )
}
