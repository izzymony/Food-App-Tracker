import { createClient } from 'https://esm.sh/@supabase/supabase-js'
const supabaseUrl = 'https://uvksbskswcsfwuuijbzx.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2a3Nic2tzd2NzZnd1dWlqYnp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzMjc2MzYsImV4cCI6MjA3MzkwMzYzNn0.s5_4FWzmqYIyQTsaK6nx8ZqYDFGz32Dwr3-QalhJWo0'
const supabase = createClient(supabaseUrl, supabaseKey)

const form  = document.getElementById("form")

form.addEventListener("submit", async(e) =>{
  e.preventDefault()

  const emailInput = document.getElementById("email");
  const email = emailInput.value.trim()


  if(!email){
     alert("Please enter your email");   
     return      
  }

  try{const {data,error}  = await supabase.auth.resetPasswordForEmail(email,{
              redirectTo:""
  })

  if(error) throw error

  alert("✅ Password reset link sent! Check your email.")
} catch(err){
    console.error(err)  
  console.error(err)
  
 alert("❌ Error sending reset link: " + err.message)
                
}
      
         
})