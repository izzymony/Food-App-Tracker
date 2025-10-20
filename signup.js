import { createClient } from 'https://esm.sh/@supabase/supabase-js'

const supabaseUrl = 'https://uvksbskswcsfwuuijbzx.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2a3Nic2tzd2NzZnd1dWlqYnp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzMjc2MzYsImV4cCI6MjA3MzkwMzYzNn0.s5_4FWzmqYIyQTsaK6nx8ZqYDFGz32Dwr3-QalhJWo0'
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
         emailRedirectTo: "https://nutri-app-tracker.vercel.app/verify_email.html",
          data: {
            full_name: fullName, 
          },
        },
      })

      if (error) throw error

      alert("Signup successful! Please check your email to confirm your account.")
      signupForm.reset()

      // Redirect user (optional)
      window.location.href = "check_email.html"
    } catch (error) {
      console.error("Error during signup:", error.message)
      alert("Signup failed: " + error.message)
    }
  })
})
