import { createClient } from "https://esm.sh/@supabase/supabase-js";
const supabaseUrl = "https://uvksbskswcsfwuuijbzx.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2a3Nic2tzd2NzZnd1dWlqYnp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzMjc2MzYsImV4cCI6MjA3MzkwMzYzNn0.s5_4FWzmqYIyQTsaK6nx8ZqYDFGz32Dwr3-QalhJWo0";

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: true, autoRefreshToken: true, storage: localStorage },
});

const tableName = "foodCollection";
const bucketName = "images_url";

// 🔥 Toast notification utility
function showToast(message, type = "info") {
  const el = document.createElement("div");
  el.textContent = message;
  el.className = `fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded shadow text-white z-[9999] ${
    type === "error"
      ? "bg-red-600"
      : type === "success"
      ? "bg-emerald-600"
      : "bg-gray-800"
  }`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2000);
}

// 🔥 Loading overlay
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

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// 🔐 Session management
supabase.auth.onAuthStateChange((event, session) => {
  console.log("Auth state changed:", event);
  if (event === "SIGNED_OUT" || event === "USER_DELETED") {
    showToast("Session expired. Please log in again.", "error");
    window.location.href = "login.html";
  }
});

async function getValidSession() {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData?.session) return sessionData.session.user;

    const { data: refreshed } = await supabase.auth.refreshSession();
    if (refreshed?.session) return refreshed.session.user;

    await supabase.auth.signOut();
    showToast("Session expired. Please log in again.", "error");
    setTimeout(() => (window.location.href = "login.html"), 800);
    return null;
  } catch (error) {
    console.error("Session error:", error);
    await supabase.auth.signOut();
    showToast("Session check failed.", "error");
    setTimeout(() => (window.location.href = "login.html"), 800);
    return null;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const foodForm = document.getElementById("foodForm");
  const foodList = document.getElementById("foodList");
  const modal = document.getElementById("addFoodModal");
  const openAddFoodBtn = document.getElementById("openAddFood");
  const closeAddFoodBtn = document.getElementById("closeAddFood");
  
  // 📦 Summary stats container
  const statsContainer = document.getElementById("foodStats");

  // 🔹 Modal toggle
  if (openAddFoodBtn && modal) {
    openAddFoodBtn.addEventListener("click", () => {
      modal.classList.remove("hidden");
      modal.classList.add("flex");
    });
  }
  if (closeAddFoodBtn && modal) {
    closeAddFoodBtn.addEventListener("click", () => {
      modal.classList.add("hidden");
    });
  }

  // 🔹 Get user
  const user = await getValidSession();
  if (!user) return;

  // 🔹 Load initial data
  await loadFoodEntries(user.id);

  // 🔹 Realtime update
  setupRealtimeListener();

  // 🔹 Handle form submit
  foodForm?.addEventListener("submit", handleSubmit);

  async function handleSubmit(e) {
    e.preventDefault();
    const foodName = document.getElementById("foodName")?.value.trim();
    const calories = parseInt(document.getElementById("calories")?.value, 10);
    const date =
      document.getElementById("date")?.value ||
      new Date().toISOString().split("T")[0];
    const fileInput = document.getElementById("foodImage");
    const file = fileInput?.files[0];

    if (!foodName || Number.isNaN(calories)) {
      showToast("Please fill all fields correctly", "error");
      return;
    }

    let imageUrl = null;
    if (file) {
      const filePath = `${user.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, file);
      if (uploadError) {
        showToast("Image upload failed", "error");
        return;
      }
      const { data } = supabase.storage.from(bucketName).getPublicUrl(filePath);
      imageUrl = data.publicUrl;
    }

    try {
      showLoading();
      const { error } = await supabase.from(tableName).insert([
        {
          foodName,
          calories,
          date,
          imageUrl,
          user_id: user.id,
        },
      ]);
      if (error) throw error;
      foodForm.reset();
      showToast("Food entry added!", "success");
      modal.classList.add("hidden");
      await loadFoodEntries(user.id);
    } catch (err) {
      console.error(err);
      showToast("Failed to add entry", "error");
    } finally {
      hideLoading();
    }
  }

  // 🔁 Realtime sync
  function setupRealtimeListener() {
    supabase
      .channel("foodCollection-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: tableName }, async () => {
        await loadFoodEntries(user.id);
      })
      .subscribe();
  }

  // 🔹 Load user’s food entries
  async function loadFoodEntries() {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      renderFoodList(data);
      updateStats(data);
    } catch (err) {
      console.error("Error loading entries:", err);
      foodList.innerHTML = `<p class="text-center text-gray-500 p-4">Failed to load entries.</p>`;
    }
  }

  // 🔹 Render summary stats
  function updateStats(items) {
    
    if (!statsContainer) return;
    if (!items.length) {
      statsContainer.innerHTML = `<div class="text-center font-bold text-black-500">No data yet</div>`;
      return;
    }

    const totalCalories = items.reduce((sum, i) => sum + (Number(i.calories) || 0), 0);
    const averageCalories = (totalCalories / items.length).toFixed(1);
    const goal = 2000;
    const percentOfGoal = ((totalCalories / (items.length * goal)) * 100).toFixed(1);

    statsContainer.innerHTML = `
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 my-4 text-center">
        <div class="bg-white p-4 rounded-xl shadow">
          <h3 class="text-gray-500 text-sm">Total Calories</h3>
          <p class="text-2xl font-bold text-green-600">${totalCalories} kcal</p>
        </div>
        <div class="bg-white p-4 rounded-xl shadow">
          <h3 class="text-gray-500 text-sm">Average per Entry</h3>
          <p class="text-2xl font-bold text-blue-600">${averageCalories} kcal</p>
        </div>
        <div class="bg-white p-4 rounded-xl shadow">
          <h3 class="text-gray-500 text-sm">Entries Logged</h3>
          <p class="text-2xl font-bold text-gray-800">${items.length}</p>
        </div>
      </div>
    `;
  }

  // 🔹 Render each food entry
  function renderFoodList(items) {
    if (!foodList) return;

    if (!items.length) {
      foodList.innerHTML = `
        <div class="p-6 text-center text-gray-500">
          No food entries yet. Click "Add Food" to create one.
        </div>`;
      return;
    }

    const html = `
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-6">
        ${items
          .map((entry) => {
            const name = escapeHtml(entry.foodName ?? "Unknown Food");
            const date = escapeHtml(entry.date ?? "");
            const calories = Number(entry.calories) || 0;
            const image = escapeHtml(entry.imageUrl ?? "https://via.placeholder.com/400");
            const progress = Math.min((calories / 2000) * 100, 100);

            return `
              <div class="bg-white rounded-2xl shadow-lg overflow-hidden transform transition duration-500 hover:animate-[tilt_1s_infinite_alternate]">
                <img src="${image}" alt="${name}" class="w-full h-48 object-cover" />
                <div class="p-4">
                  <h2 class="text-lg font-semibold text-gray-800">${name}</h2>
                  <p class="text-gray-500 text-sm">${date}</p>

                  <div class="flex items-center justify-between mt-3">
                    <div class="w-full bg-gray-200 h-2 rounded-full mr-2 overflow-hidden">
                      <div class="bg-green-500 h-2 rounded-full transition-all duration-700" style="width: ${progress}%;"></div>
                    </div>
                    <span class="text-gray-700 text-sm">${calories} / 2000 kcal</span>
                  </div>

                  <div class="mt-4 flex justify-end">
                    <button data-id="${entry.id}" class="delete-entry text-red-600 hover:underline font-medium">Delete</button>
                  </div>
                </div>
              </div>
            `;
          })
          .join("")}
      </div>
    `;

    foodList.innerHTML = html;

    // Delete
    foodList.querySelectorAll(".delete-entry").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const id = e.currentTarget.getAttribute("data-id");
        if (!id) return;

        try {
          showLoading();
          const { error } = await supabase.from(tableName).delete().eq("id", id);
          if (error) throw error;
          showToast("Entry deleted", "success");
          await loadFoodEntries(user.id);
        } catch (err) {
          console.error("Delete failed:", err);
          showToast("Failed to delete", "error");
        } finally {
          hideLoading();
        }
      });
    });
  }
});
