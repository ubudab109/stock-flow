import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { useCurrentUser, useRegister } from '../auth/useAuth'
import { ApiError } from '../lib/api-client'

const registerSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
})

type RegisterFormValues = z.infer<typeof registerSchema>

export function RegisterPage() {
  const navigate = useNavigate()
  const { data: user, isLoading: isLoadingUser } = useCurrentUser()
  const registerUser = useRegister()
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterFormValues>({ resolver: zodResolver(registerSchema) })

  useEffect(() => {
    if (user) {
      navigate('/', { replace: true })
    }
  }, [user, navigate])

  if (isLoadingUser || user) {
    return null
  }

  const onSubmit = handleSubmit((values) => {
    registerUser.mutate(values, {
      onSuccess: () => setSuccess(true),
      onError: (error) => {
        const message = error instanceof ApiError ? error.message : 'Something went wrong. Please try again.'
        setError('root', { message })
      },
    })
  })

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-gray-900">Create your account</h1>
        <p className="mb-6 text-sm text-gray-500">Set up access to your StockFlow workspace.</p>

        {success ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-green-700">Account created. You can now sign in.</p>
            <Link
              to="/login"
              className="rounded-md bg-indigo-600 px-3 py-2 text-center text-sm font-medium text-white hover:bg-indigo-500"
            >
              Go to sign in
            </Link>
          </div>
        ) : (
          <>
            <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
              <div>
                <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  {...register('email')}
                />
                {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
              </div>

              <div>
                <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  {...register('password')}
                />
                {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>}
              </div>

              {errors.root && <p className="text-sm text-red-600">{errors.root.message}</p>}

              <button
                type="submit"
                disabled={registerUser.isPending}
                className="mt-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {registerUser.isPending ? 'Creating account…' : 'Create account'}
              </button>
            </form>

            <p className="mt-4 text-center text-sm text-gray-500">
              Already have an account?{' '}
              <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
                Sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
