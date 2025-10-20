import { createClient } from 'https://esm.sh/@supabase/supabase-js'

const supabaseUrl = 'https://uvksbskswcsfwuuijbzx.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2a3Nic2tzd2NzZnd1dWlqYnp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzMjc2MzYsImV4cCI6MjA3MzkwMzYzNn0.s5_4FWzmqYIyQTsaK6nx8ZqYDFGz32Dwr3-QalhJWo0'
const supabase = createClient(supabaseUrl, supabaseKey)


document.addEventListener("DOMContentLoaded", () => {
  const loginBtn = document.getElementById("loginBtn");
  loginBtn.addEventListener("click", () => {
    window.location.href = "login.html";
  });
});

document.addEventListener("DomContentLoaded", async() =>{
  const status =  document.getElementById("statusMessage");
  const loginBtn = document.getElementById("loginBtn");
 

 
  try{
     const hashParams = new URLSearchParams(window.location.hash.substring(1)) ;
     const access_token = hashParams.get("access_token")  
     const type = hashParams.get("type")      

     if(type = "signup" && access_token){
       const {data, error}   = await supabase.auth.exchangeCodeForSession(access_token);
       if(error) throw error
       
       status.textContent = "Your email has been successfully verified 🎉"
     
     }else{
                status.textContent = "Verification Link invalid"
     }
  }catch(err){
     console.error("Verification error:", err)    
     status.textContent = "Something went wrong verifying your email."     
  }
})