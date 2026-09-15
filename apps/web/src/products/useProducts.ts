import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Paginated, Product } from '@eterna/shared'
import { apiClient } from '../lib/api-client'

export interface ProductsQuery {
  page: number
  pageSize: number
  search: string
}

export interface ProductInput {
  sku: string
  name: string
  description?: string
  unitPrice: number
  quantityOnHand: number
}

const PRODUCTS_KEY = 'products'

export function useProducts(query: ProductsQuery) {
  const params = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
    ...(query.search ? { search: query.search } : {}),
  })

  return useQuery({
    queryKey: [PRODUCTS_KEY, query],
    queryFn: () => apiClient.get<Paginated<Product>>(`/products?${params.toString()}`),
    placeholderData: keepPreviousData,
  })
}

export function useCreateProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: ProductInput) => apiClient.post<Product>('/products', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [PRODUCTS_KEY] }),
  })
}

export function useUpdateProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ProductInput> }) =>
      apiClient.patch<Product>(`/products/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [PRODUCTS_KEY] }),
  })
}

export function useDeleteProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.delete<void>(`/products/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [PRODUCTS_KEY] }),
  })
}
