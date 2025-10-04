import { createClient } from 'https://esm.sh/@supabase/supabase-js'
const supabaseUrl = 'https://uvksbskswcsfwuuijbzx.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2a3Nic2tzd2NzZnd1dWlqYnp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzMjc2MzYsImV4cCI6MjA3MzkwMzYzNn0.s5_4FWzmqYIyQTsaK6nx8ZqYDFGz32Dwr3-QalhJWo0'
const supabase = createClient(supabaseUrl, supabaseKey)

document.addEventListener("DOMContentLoaded", () => {
 const form = document.getElementById("form")    
 
 form.addEventListener("submit", async(e) =>{
   e.preventDefault();
   const email = document.getElementById("email").value.trim();
   const password = document.getElementById("password").value.trim()
   
   try{
    const {data,error} = await supabase.auth.signInWithPassword({
     email,
     password,      
              
    })         
    if(error) throw error;
    alert("Login Successful")
    
    window.location.href = "food-tracker.html"; // Redirect to food-tracker.html on successful login
   }
   
   catch(error){
              console.error("Error logging in:", error.message);
              alert("Error logging in: " + error.message);
              return;
   }
 })
})
