import { useAuth } from '~/composables/useAuth'

export default defineNuxtRouteMiddleware(async (to, from) => {
    const { user, fetchUser, isAuthenticated } = useAuth()

    // Always try to fetch user on first load (server or client) if not present
    if (!user.value) {
        await fetchUser()
    }

    // Protected Routes
    const protectedRoutes = ['/game']
    
    // If route is protected and user is not authenticated
    if (protectedRoutes.includes(to.path) && !user.value) {
        return navigateTo('/login')
    }
})
