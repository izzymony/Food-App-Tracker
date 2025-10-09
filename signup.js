import { createClient } from 'https://esm.sh/@supabase/supabase-js'

const supabaseUrl = 'https://uvksbskswcsfwuuijbzx.supabase.co'
const supabaseKey = 'YOUR_PUBLIC_ANON_KEY' // ⚠️ keep this public, not the service key!
const supabase = createClient(supabaseUrl, supabaseKey)

document.addEventListener("DOMContentLoaded", () => {
  const signupForm = document.getElementById("signupForm")

  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault()

    const fullName = document.getElementById("fullName").value.trim()
    const email = document.getElementById("email").value.trim()
    const password = document.getElementById("password").value.trim()
    const confirmPassword = document.getElementById("confirmPassword").value.trim()

    if (password !== confirmPassword) {
      alert("Passwords do not match!")
      return
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: fullName, // ✅ metadata key matches SQL trigger
          },
        },
      })

      if (error) throw error

      alert("Signup successful! Please check your email to confirm your account.")
      signupForm.reset()

      // Redirect user (optional)
      window.location.href = "food-tracker.html"
    } catch (error) {
      console.error("Error during signup:", error.message)
      alert("Signup failed: " + error.message)
    }
  })
})
