
import { table } from 'console';
import { createClient } from 'https://esm.sh/@supabase/supabase-js'
const supabaseUrl = 'https://uvksbskswcsfwuuijbzx.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2a3Nic2tzd2NzZnd1dWlqYnp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzMjc2MzYsImV4cCI6MjA3MzkwMzYzNn0.s5_4FWzmqYIyQTsaK6nx8ZqYDFGz32Dwr3-QalhJWo0'
const supabase = createClient(supabaseUrl, supabaseKey)

const tableName = 'foodCollection';
const bucketName = 'images_url'
 
// Initialize Firebase


// Simple UI helpers
function showToast(message, type = "info") {
  // Minimal toast implementation; replace with your own UI if desired
  const el = document.createElement("div");
  el.textContent = message;
  el.className = `fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded shadow text-white ${
    type === "error" ? "bg-red-600" : type === "success" ? "bg-emerald-600" : "bg-gray-800"
  }`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2000);
}

let loadingMask;
function showLoading() {
  if (loadingMask) return;
  loadingMask = document.createElement("div");
  loadingMask.className =
    "fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center";
  loadingMask.innerHTML =
    '<div class="bg-white px-4 py-3 rounded shadow text-gray-700">Loading...</div>';
  document.body.appendChild(loadingMask);
}
function hideLoading() {
  if (!loadingMask) return;
  loadingMask.remove();
  loadingMask = null;
}

// HTML escape to prevent XSS when rendering text into the DOM
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

document.addEventListener("DOMContentLoaded", () => {
  const foodForm = document.getElementById("foodForm");
  const foodList = document.getElementById("foodList");

  // Modal open/close (optional if you have these elements)
  const modal = document.getElementById("addFoodModal");
  const openAddFoodBtn = document.getElementById("openAddFood");
  const closeAddFoodBtn = document.getElementById("closeAddFood");

  if (openAddFoodBtn && modal) {
    openAddFoodBtn.addEventListener("click", () => modal.classList.remove("hidden"));
  }
  if (closeAddFoodBtn && modal) {
    closeAddFoodBtn.addEventListener("click", () => modal.classList.add("hidden"));
  }

  if (foodForm) {
    foodForm.addEventListener("submit", handleSubmit);
  } else {
    console.warn("foodForm element not found in DOM.");
  }

  setupRealtimeListener();
  // Optionally also load once (useful for initial paint if offline)
  loadFoodEntries();

  async function handleSubmit(e) {
    e.preventDefault();

    const foodNameInput = document.getElementById("foodName");
    const caloriesInput = document.getElementById("calories");
    const dateInput = document.getElementById("date");
   
    const foodName = foodNameInput?.value.trim();
    const calories = parseInt(caloriesInput?.value, 10);
    const date =
      dateInput?.value || new Date().toISOString().split("T")[0];

     const fileInput = document.getElementById('foodImage') 
     const file = fileInput?.files[0]

    if (!foodName || Number.isNaN(calories) || calories < 0) {
      showToast("Please fill all the fields correctly", "error");
      return;
    }

    let imageUrl = null;

    if(file){
      const filePath = `${user?.id || "anon"}/${Date.now()}-${file.name}`;
      const {error: uploadError} = await supabase.storage
      .from(bucketName)
      .upload(filePath, file);

      if(uploadError){
        console.error('Upload error:', uploadError);
        alert("Image upload failed");
        return;
      }
      const {data} = supabase.from(bucketName).getPublicUrl(filePath);
      imageUrl = data.publicUrl
    }

    try{
      showLoading();

      const {error} = await supabase.from(tableName).insert([
        {
          foodName: foodName, 
          date,
          calories,
          imageUrl: imageUrl,
          user_id: user?.id || null
        }
      ])

      if (error) throw error;
      foodForm.reset();
      showToast('Food entry added successfully', "success")
      if(modal) modal.classList.add('hidden')
      
    }catch(error){
      console.error("Error adding entry:", error);
      showToast("Error adding entry", "error");
    } finally{
      hideLoading();
    }
  }

  function setupRealtimeListener() {
    supabase
    .channel("foodCollection")
    .on(
      "postgres",
      {event: '*' ,schema: 'public', table: tableName},
      (payload)=>{
        console.log("Realtime change", payload)
        loadFoodEntries()
      }
    )
    .subscribe();
  }

  async function loadFoodEntries() {
  try{
    const {data, error} = await supabase
    .from(tableName)
    .select("*")
    .order("created_at", {ascending:false});

    if (error) throw error;

    renderFoodList(data || [])
  }catch(error){
    console.error("Error loading food entries:", err);
    foodList.innerHTML
  }
  }

  function renderFoodList(items) {
    if (!foodList) return;

    if (!items.length) {
      foodList.innerHTML = `
        <div class="p-6 text-center text-gray-500">
          No food entries yet. Click "Add Food" to create one.
        </div>`;
      return;
    }

    const html = items
      .map((entry) => {
        const name = escapeHtml(entry.foodName ?? "");
        const date = escapeHtml(entry.date ?? "");
        const calories = Number(entry.calories) || 0;

        return `
          <li class="flex items-center justify-between p-3 hover:bg-gray-50">
            <div>
              <p class="font-semibold text-gray-900">${name}</p>
              <p class="text-sm text-gray-500">${date}</p>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-gray-900 font-medium">${calories} kcal</span>
              <button data-id="${entry.id}" class="delete-entry text-red-600 hover:underline">Delete</button>
            </div>
          </li>
        `;
      })
      .join("");

    foodList.innerHTML = `<ul class="divide-y divide-gray-200">${html}</ul>`;

    // Wire up delete buttons
    foodList.querySelectorAll(".delete-entry").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const id = e.currentTarget.getAttribute("data-id");
        if (!id) return;
        try {
          await deleteDoc(doc(db, "foodEntries", id));
          showToast("Entry deleted", "success");
        } catch (err) {
          console.error("Delete failed:", err);
          showToast("Failed to delete", "error");
        }
      });
    });
  }
});