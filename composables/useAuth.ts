export const useAuth = () => {
    const user = useState<any>('auth_user', () => null)
    const pending = useState('auth_pending', () => false)

    const fetchUser = async () => {
        pending.value = true
        try {
            const { data } = await useFetch('/api/auth/me')
            if (data.value && data.value.user) {
                user.value = data.value.user
            } else {
                user.value = null
            }
        } catch (e) {
            user.value = null
        } finally {
            pending.value = false
        }
    }

    const logout = async () => {
        await useFetch('/api/auth/logout', { method: 'POST' })
        user.value = null
        navigateTo('/login')
    }

    return {
        user,
        fetchUser,
        logout,
        isAuthenticated: computed(() => !!user.value)
    }
}
