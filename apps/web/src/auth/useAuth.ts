import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AuthUser } from '@eterna/shared'
import { apiClient } from '../lib/api-client'

const CURRENT_USER_KEY = ['auth', 'me']

export function useCurrentUser() {
  return useQuery({
    queryKey: CURRENT_USER_KEY,
    queryFn: () => apiClient.get<AuthUser>('/auth/me'),
  })
}

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { email: string; password: string }) =>
      apiClient.post<{ user: AuthUser }>('/auth/login', data),
    onSuccess: (data) => {
      queryClient.setQueryData(CURRENT_USER_KEY, data.user)
    },
  })
}

export function useRegister() {
  return useMutation({
    mutationFn: (data: { email: string; password: string }) => apiClient.post<AuthUser>('/auth/register', data),
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiClient.post<void>('/auth/logout'),
    onSuccess: () => {
      queryClient.setQueryData(CURRENT_USER_KEY, null)
    },
  })
}
