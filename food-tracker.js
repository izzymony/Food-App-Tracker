import { createClient } from "https://esm.sh/@supabase/supabase-js";

// 🔗 Supabase setup
const supabaseUrl = "https://uvksbskswcsfwuuijbzx.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2a3Nic2tzd2NzZnd1dWlqYnp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzMjc2MzYsImV4cCI6MjA3MzkwMzYzNn0.s5_4FWzmqYIyQTsaK6nx8ZqYDFGz32Dwr3-QalhJWo0";

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: true, autoRefreshToken: true, storage: localStorage },
});

// ⚙️ Constants
const FOOD_TABLE = "foodCollection";
const GOAL_TABLE = "user_goal";
const BUCKET = "images_url";
let caloriesChart;
 let userGoal = {goal_value:0, goal_type:"daily"}

// ✅ Utility functions
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
  if (loadingMask) loadingMask.remove();
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

// 🧭 Auth session management
supabase.auth.onAuthStateChange((event) => {
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


// MAIN LOGIC

document.addEventListener("DOMContentLoaded", async () => {
  // DOM elements
  const foodForm = document.getElementById("foodForm");
  const foodList = document.getElementById("foodList");
  const modal = document.getElementById("addFoodModal");
  const openAddFoodBtn = document.getElementById("openAddFood");
  const closeAddFoodBtn = document.getElementById("closeAddFood");
  const statsContainer = document.getElementById("foodStats");
  const filterSelect = document.getElementById("timeFilter");
  const goalForm = document.getElementById("goalForm");
  const goalInput = document.getElementById("goalInput");
  const goalTypeSelect = document.getElementById("goalTypeSelect");
 

  // Modal controls
  openAddFoodBtn?.addEventListener("click", () => {
    modal.classList.remove("hidden");
    modal.classList.add("flex");
  });
  closeAddFoodBtn?.addEventListener("click", () => modal.classList.add("hidden"));

  // Authenticated user
  const user = await getValidSession();
  if (!user) return;

  // Load initial data
  await loadUserGoal(user);
  await loadFoodEntries(user.id);
  await loadDailyGoalAndProgress();

  setupRealtimeListener(user);

  // Filters
  filterSelect?.addEventListener("change", (e) =>
    loadFoodEntries(user.id, e.target.value)
  );

  // Save goal
  goalForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await saveUserGoal(user);
  });

  // Add food
  foodForm?.addEventListener("submit", (e) => handleFoodSubmit(e, user));

  // ✅ Load user goal
  async function loadUserGoal(user) {
    const { data, error } = await supabase
      .from(GOAL_TABLE)
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("Error loading goal:", error);
      return;
    }

    if (data) {
      goalInput.value = data.goal_value;
      goalTypeSelect.value = data.goal_type;
    }else{
       userGoal = { goal_value: 0, goal_type: "daily" };
    }
  }

  

  // ✅ Save user goal (Upsert)
  async function saveUserGoal(user) {
    const goalValue = parseFloat(goalInput.value);
    const goalType = goalTypeSelect.value;

    const { data, error } = await supabase
      .from(GOAL_TABLE)
      .upsert(
        {
          user_id: user.id,
          goal_type: goalType,
          goal_value: goalValue,
          updated_at: new Date(),
        },
        { onConflict: "user_id" }
      )
      .select("*")
      .single();

    if (error) {
      console.error("❌ Save goal error:", error);
      showToast("Failed to save goal.", "error");
    } else {
      showToast("✅ Goal saved successfully!", "success");
      await loadUserGoal(user);
    }
  }

  // ✅ Handle adding new food
  async function handleFoodSubmit(e, user) {
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
        .from(BUCKET)
        .upload(filePath, file);
      if (uploadError) {
        showToast("Image upload failed", "error");
        return;
      }
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
      imageUrl = data.publicUrl;
    }

    try {
      showLoading();
      const { error } = await supabase.from(FOOD_TABLE).insert([
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

  // ✅ Load and render food entries
  async function loadFoodEntries(userId, filter = "all") {
    try {
      const { data, error } = await supabase
        .from(FOOD_TABLE)
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const filteredData = filterEntriesByTime(data, filter);
      renderFoodList(filteredData);
      updateStats(filteredData);
      renderCalorieChart(filteredData);
    } catch (err) {
      console.error("Error loading entries:", err);
      foodList.innerHTML = `<p class="text-center text-gray-500 p-4">Failed to load entries.</p>`;
    }
  }

  //Goal progress-bar
  async function loadDailyGoalAndProgress() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Fetch daily goal
  const { data: goalData, error: goalError } = await supabase
    .from("user_goal")
    .select("*")
    .eq("user_id", user.id)
    .eq("goal_type", "daily")
    .single();

  if (goalError || !goalData) {
    console.log("No daily goal found");
    return;
  }

  const dailyGoal = goalData.goal_value;

  // Fetch today’s entries
  const today = new Date().toISOString().split("T")[0];
  const { data: entries } = await supabase
    .from("food_entries")
    .select("calories, created_at")
    .eq("user_id", user.id);

  const todaysEntries = entries.filter(entry => entry.created_at.startsWith(today));
  const totalCalories = todaysEntries.reduce((sum, e) => sum + e.calories, 0);

  // Calculate progress
  const percent = Math.min((totalCalories / dailyGoal) * 100, 100);
  const progress = document.getElementById("dailyProgress");
  const progressText = document.getElementById("progressText");

  if (progress) {
    progress.style.width = `${percent}%`;

    // Color feedback based on progress
    if (totalCalories >= dailyGoal) {
      progress.classList.remove("bg-[#3b82f6]");
      progress.classList.add("bg-red-500", "animate-pulse");
    } else {
      progress.classList.remove("bg-red-500", "animate-pulse");
      progress.classList.add("bg-[#3b82f6]");
    }
  }

  if (progressText) {
    progressText.textContent = `${totalCalories} / ${dailyGoal} kcal`;
  }
}


  // ✅ Filter entries by time
  function filterEntriesByTime(entries, filterType) {
    if (filterType === "all") return entries;
    const now = new Date();

    return entries.filter((entry) => {
      const entryDate = new Date(entry.date);

      if (filterType === "week") {
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 7);
        return entryDate >= startOfWeek && entryDate < endOfWeek;
      }

      if (filterType === "month") {
        return (
          entryDate.getMonth() === now.getMonth() &&
          entryDate.getFullYear() === now.getFullYear()
        );
      }

      return true;
    });
  }

  // ✅ Render calories chart
  function renderCalorieChart(entries) {
    const ctx = document.getElementById("caloriesChart");
    if (!ctx) return;

    const grouped = entries.reduce((acc, e) => {
      const date = e.date.split("T")[0];
      acc[date] = (acc[date] || 0) + Number(e.calories);
      return acc;
    }, {});

    const labels = Object.keys(grouped).sort();
    const data = labels.map((d) => grouped[d]);

    if (caloriesChart) caloriesChart.destroy();

    caloriesChart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Calories per Day",
            data,
            borderColor: "#10b981",
            backgroundColor: "rgba(16,185,129,0.2)",
            fill: true,
            tension: 0.3,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { title: { display: true, text: "Date" } },
          y: { title: { display: true, text: "Calories" } },
        },
      },
    });
  }

  // ✅ Update stats section
  function updateStats(items) {
  if (!statsContainer) return;
  if (!items.length) {
    statsContainer.innerHTML = `<div class="text-center font-bold text-gray-500">No data yet</div>`;
    return;
  }

  // Filter for goal type
  let relevantItems = items;
  const now = new Date();
  if (userGoal.goal_type === "daily") {
    relevantItems = items.filter(
      (i) => new Date(i.date).toDateString() === now.toDateString()
    );
  } else if (userGoal.goal_type === "weekly") {
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    relevantItems = items.filter((i) => new Date(i.date) >= startOfWeek);
  } else if (userGoal.goal_type === "monthly") {
    relevantItems = items.filter(
      (i) =>
        new Date(i.date).getMonth() === now.getMonth() &&
        new Date(i.date).getFullYear() === now.getFullYear()
    );
  }

  const totalCalories = relevantItems.reduce(
    (sum, i) => sum + (Number(i.calories) || 0),
    0
  );
  const averageCalories = (totalCalories / relevantItems.length || 0).toFixed(1);
  const goalValue = userGoal.goal_value || 2000; // fallback
  const progress = Math.min((totalCalories / goalValue) * 100, 100);

  statsContainer.innerHTML = `
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 my-4 text-center">
      <div class="bg-white p-4 rounded-xl shadow">
        <h3 class="text-gray-500 text-sm">Total Calories</h3>
        <p class="text-2xl font-bold text-green-600">${totalCalories} kcal</p>
      </div>
      <div class="bg-white p-4 rounded-xl shadow">
        <h3 class="text-gray-500 text-sm">Goal Progress (${userGoal.goal_type})</h3>
        <div class="w-full bg-gray-200 h-3 rounded-full mt-2 overflow-hidden">
          <div class="bg-emerald-500 h-3 rounded-full transition-all duration-700" style="width: ${progress}%;"></div>
        </div>
        <p class="text-sm mt-1 text-gray-600">${progress.toFixed(1)}% of goal (${goalValue} kcal)</p>
      </div>
      <div class="bg-white p-4 rounded-xl shadow">
        <h3 class="text-gray-500 text-sm">Average per Entry</h3>
        <p class="text-2xl font-bold text-blue-600">${averageCalories} kcal</p>
      </div>
    </div>`;
}
if (progress >= 100) {
  showToast(`🎉 You’ve reached your ${userGoal.goal_type} goal!`, "success");
}



  // ✅ Render food cards
  function renderFoodList(items) {
    if (!foodList) return;
    if (!items.length) {
      foodList.innerHTML = `<div class="p-6 text-center text-gray-500">No food entries yet. Click "Add Food" to create one.</div>`;
      return;
    }

    foodList.innerHTML = `
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        ${items
          .map((entry) => {
            const name = escapeHtml(entry.foodName ?? "Unknown Food");
            const date = escapeHtml(entry.date ?? "");
            const calories = Number(entry.calories) || 0;
            const image = escapeHtml(entry.imageUrl ?? "https://via.placeholder.com/400");
            const goalValue = userGoal.goal_value || 2000;
const progress = Math.min((calories / goalValue) * 100, 100);


            return `
              <div class="bg-white rounded-2xl shadow-lg overflow-hidden transition duration-500 hover:scale-[1.02]">
                <img src="${image}" alt="${name}" class="w-full h-48 object-cover" />
                <div class="p-4">
                  <h2 class="text-lg font-semibold text-gray-800">${name}</h2>
                  <p class="text-gray-500 text-sm">${date}</p>
                  <div class="flex items-center justify-between mt-3">
                    <div class="w-full bg-gray-200 h-2 rounded-full mr-2 overflow-hidden">
                      <div class="bg-emerald-500 h-2 rounded-full transition-all duration-700" style="width: ${progress}%;"></div>
                    </div>
                    <span class="text-gray-700 text-sm">${calories} / 2000 kcal</span>
                  </div>
                  <div class="mt-4 flex justify-end">
                    <button data-id="${entry.id}" class="delete-entry text-red-600 hover:underline font-medium">Delete</button>
                  </div>
                </div>
              </div>`;
          })
          .join("")}
      </div>`;

    foodList.querySelectorAll(".delete-entry").forEach((btn) =>
      btn.addEventListener("click", async (e) => {
        const id = e.currentTarget.getAttribute("data-id");
        if (!id) return;
        try {
          showLoading();
          const { error } = await supabase.from(FOOD_TABLE).delete().eq("id", id);
          if (error) throw error;
          showToast("Entry deleted", "success");
          await loadFoodEntries(user.id);
        } catch (err) {
          console.error("Delete failed:", err);
          showToast("Failed to delete", "error");
        } finally {
          hideLoading();
        }
      })
    );
  }

  // ✅ Real-time listener
  function setupRealtimeListener(user) {
    supabase
      .channel("foodCollection-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: FOOD_TABLE },
        async () => loadFoodEntries(user.id)
      )
      .subscribe();
  }
});
