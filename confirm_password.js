import { createClient } from 'https://esm.sh/@supabase/supabase-js'
const supabaseUrl = 'https://uvksbskswcsfwuuijbzx.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2a3Nic2tzd2NzZnd1dWlqYnp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzMjc2MzYsImV4cCI6MjA3MzkwMzYzNn0.s5_4FWzmqYIyQTsaK6nx8ZqYDFGz32Dwr3-QalhJWo0'
const supabase = createClient(supabaseUrl, supabaseKey)


const {error}  = supabase.auth.onAuthStateChange(async(event,session) =>{
  if(event  === "PASSWORD_RECOVERY" && session ){
    setupForm()
  }
})




function setupForm(){
  
const form  = document.getElementById("form")
form.addEventListener("submit", async(event)=>{

event.preventDefault();
 
 const password = document.getElementById("password").value.trim()          
 const confirmPassword  = document.getElementById("confirmPassword").value.trim()   

 const { data } = await supabase.auth.getSession()
console.log(data)


if(password !== confirmPassword || password.length < 8  ){
  alert("Passwords must match and be at least 8 characters long!")  
  
  return;
}


try{
  const{data, error} = await supabase.auth.updateUser({password})     
  
  if(error){
    alert("password update not successful")
  }else{
    alert("✅ Password updated successfully! You can now log in.")
    window.location.href = "login.html"
    
  }

  
}catch (err) {
    console.error("Error updating password:", err)
    alert("❌ Failed to reset password: " + err.message)
  }
              
} )
}
