import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Invoice, InvoiceStatus, Paginated } from '@eterna/shared'
import { apiClient } from '../lib/api-client'

export interface InvoicesQuery {
  page: number
  pageSize: number
  status?: InvoiceStatus
  search?: string
}

export interface InvoiceItemInput {
  productId: string
  quantity: number
}

export interface CreateInvoiceInput {
  customerName: string
  issueDate?: string
  dueDate?: string
  notes?: string
  items: InvoiceItemInput[]
}

const INVOICES_KEY = 'invoices'

export function useInvoices(query: InvoicesQuery) {
  const params = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
    ...(query.status ? { status: query.status } : {}),
    ...(query.search ? { search: query.search } : {}),
  })

  return useQuery({
    queryKey: [INVOICES_KEY, query],
    queryFn: () => apiClient.get<Paginated<Invoice>>(`/invoices?${params.toString()}`),
    placeholderData: keepPreviousData,
  })
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: [INVOICES_KEY, id],
    queryFn: () => apiClient.get<Invoice>(`/invoices/${id}`),
  })
}

export function useCreateInvoice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateInvoiceInput) => apiClient.post<Invoice>('/invoices', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [INVOICES_KEY] }),
  })
}

function useInvoiceAction(action: 'issue' | 'pay' | 'cancel') {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.post<Invoice>(`/invoices/${id}/${action}`),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: [INVOICES_KEY] })
      queryClient.setQueryData([INVOICES_KEY, updated.id], updated)
    },
  })
}

export const useIssueInvoice = () => useInvoiceAction('issue')
export const usePayInvoice = () => useInvoiceAction('pay')
export const useCancelInvoice = () => useInvoiceAction('cancel')
