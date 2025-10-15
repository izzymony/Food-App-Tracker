import { createClient } from 'https://esm.sh/@supabase/supabase-js'

// Initialize Supabase
const supabaseUrl = 'https://uvksbskswcsfwuuijbzx.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2a3Nic2tzd2NzZnd1dWlqYnp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzMjc2MzYsImV4cCI6MjA3MzkwMzYzNn0.s5_4FWzmqYIyQTsaK6nx8ZqYDFGz32Dwr3-QalhJWo0'
const supabase = createClient(supabaseUrl, supabaseKey)

// DOM elements
const profileContainer = document.getElementById("profileContainer")
const logoutBtn = document.getElementById("logoutBtn")
const avatarInitial = document.getElementById("avatarInitial")

document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      profileContainer.innerHTML = `
        <p class="text-red-500 font-medium">You are not logged in.</p>
        <a href="index.html" class="text-[#10b981] underline text-sm">Go to Login</a>
      `
      return
    }

    // Fetch user data from 'users' table
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, created_at')
      .eq('id', user.id)
      .single()

    if (error) throw error

    // Set avatar initial
    avatarInitial.textContent = data.full_name ? data.full_name.charAt(0).toUpperCase() : 'U'

    // Display info
    profileContainer.innerHTML = `
      <h2 class="text-2xl font-bold text-gray-800">${data.full_name || 'No name set'}</h2>
      <p class="text-gray-500">${data.email}</p>

      <div class="mt-6 bg-gray-50 p-4 rounded-lg text-left space-y-2 border border-gray-100">
        <p><span class="font-semibold text-gray-700">User ID:</span> <span class="text-gray-600 text-sm">${data.id}</span></p>
        <p><span class="font-semibold text-gray-700">Account Created:</span> <span class="text-gray-600">${new Date(data.created_at).toLocaleString()}</span></p>
      </div>
    `
  } catch (err) {
    console.error("Error loading profile:", err.message)
    profileContainer.innerHTML = `<p class="text-red-500">Failed to load profile.</p>`
  }
})

// Logout
logoutBtn.addEventListener("click", async () => {
  await supabase.auth.signOut()
  window.location.href = "index.html"
})
