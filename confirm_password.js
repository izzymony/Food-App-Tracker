import { createClient } from 'https://esm.sh/@supabase/supabase-js'
const supabaseUrl = 'https://uvksbskswcsfwuuijbzx.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2a3Nic2tzd2NzZnd1dWlqYnp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzMjc2MzYsImV4cCI6MjA3MzkwMzYzNn0.s5_4FWzmqYIyQTsaK6nx8ZqYDFGz32Dwr3-QalhJWo0'
const supabase = createClient(supabaseUrl, supabaseKey)

const form  = document.getElementById("form")

form.addEventListener("submit", async()=>{
 
 const password = document.getElementById("password").value.trim()          
 const confirmPassword  = document.getElementById("confirmPassword").value.trim()   

if(password !== confirmPassword  && password.length < 8  ){
  alert("Passwords must match and be at least 8 characters long!")        
}


try{
  const{data, error} = await supabase.auth.            
}
              
} )