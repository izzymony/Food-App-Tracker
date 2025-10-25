// food-tracker.js (complete, fixed, robust)
import { createClient } from "https://esm.sh/@supabase/supabase-js";

// ---------- CONFIG ----------
const SUPABASE_URL = "https://uvksbskswcsfwuuijbzx.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2a3Nic2tzd2NzZnd1dWlqYnp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzMjc2MzYsImV4cCI6MjA3MzkwMzYzNn0.s5_4FWzmqYIyQTsaK6nx8ZqYDFGz32Dwr3-QalhJWo0";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storage: localStorage },
});

const FOOD_TABLE = "foodCollection";
const GOAL_TABLE = "user_goal";
const BUCKET = "images_url";

// ---------- STATE ----------
let caloriesChart = null;
let userGoal = { goal_value: 0, goal_type: "daily" };

// ---------- UTILITIES ----------
function showToast(message, type = "info") {
  const el = document.createElement("div");
  el.textContent = message;
  el.className = `fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded shadow text-white z-[9999] ${
    type === "error" ? "bg-red-600" : type === "success" ? "bg-emerald-600" : "bg-gray-800"
  }`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

let loadingMask = null;
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

// ---------- AUTH HELPERS ----------
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

    // no session, sign out and redirect
    await supabase.auth.signOut();
    showToast("Session expired. Please log in.", "error");
    setTimeout(() => (window.location.href = "login.html"), 700);
    return null;
  } catch (err) {
    console.error("Session error:", err);
    await supabase.auth.signOut();
    showToast("Session check failed.", "error");
    setTimeout(() => (window.location.href = "login.html"), 700);
    return null;
  }
}

// ---------- MAIN ----------
document.addEventListener("DOMContentLoaded", async () => {
  // DOM refs
  const foodForm = document.getElementById("foodForm");
  const foodList = document.getElementById("foodList");
  const modal = document.getElementById("addFoodModal");
  const openAddFoodBtn = document.getElementById("openAddFood");
  const openAddFoodMobile = document.getElementById("openAddFoodMobile");
  const closeAddFoodBtn = document.getElementById("closeAddFood");
  const statsContainer = document.getElementById("foodStats");
  const filterSelect = document.getElementById("timeFilter");
  const goalForm = document.getElementById("goalForm");
  const goalInput = document.getElementById("goalInput");
  const goalTypeSelect = document.getElementById("goalTypeSelect");

  // modal handlers
  openAddFoodBtn?.addEventListener("click", () => {
    modal?.classList.remove("hidden");
    modal?.classList.add("flex");
  });
  openAddFoodMobile?.addEventListener("click", () => {
    modal?.classList.remove("hidden");
    modal?.classList.add("flex");
  });
  closeAddFoodBtn?.addEventListener("click", () => modal?.classList.add("hidden"));

  // ensure signed in
  const user = await getValidSession();
  if (!user) return;

  // initial loading
  await loadUserGoal(user);
  await loadFoodEntries(user.id);
  await loadDailyGoalAndProgress(user);

  // consolidated realtime
  setupRealtime(user);

  // UI events
  filterSelect?.addEventListener("change", (e) => loadFoodEntries(user.id, e.target.value));
  goalForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await saveUserGoal(user);
  });
  foodForm?.addEventListener("submit", (e) => handleFoodSubmit(e, user));

  // ---------- FUNCTIONS ----------

  // load user goal to populate form + cache
  async function loadUserGoal(user) {
    try {
      const { data, error } = await supabase.from(GOAL_TABLE).select("*").eq("user_id", user.id).single();
      if (error && error.code !== "PGRST116") {
        console.error("Error loading goal:", error);
        showToast("Could not load goal", "error");
        userGoal = { goal_value: 0, goal_type: "daily" };
        return;
      }
      if (data) {
        userGoal = data;
        if (goalInput) goalInput.value = data.goal_value;
        if (goalTypeSelect) goalTypeSelect.value = data.goal_type;
      } else {
        userGoal = { goal_value: 0, goal_type: "daily" };
      }
    } catch (err) {
      console.error("loadUserGoal err:", err);
    }
  }

  // upsert user goal
  async function saveUserGoal(user) {
    const value = parseFloat(goalInput?.value || "0");
    const type = goalTypeSelect?.value || "daily";
    if (!value || value <= 0) {
      showToast("Enter a valid positive goal value", "error");
      return;
    }
    showLoading();
    try {
      const { data, error } = await supabase
        .from(GOAL_TABLE)
        .upsert({ user_id: user.id, goal_type: type, goal_value: value, updated_at: new Date() }, { onConflict: "user_id" })
        .select("*")
        .single();
      hideLoading();
      if (error) throw error;
      userGoal = data;
      showToast("Goal saved!", "success");
      await loadDailyGoalAndProgress(user); // refresh progress immediately
    } catch (err) {
      hideLoading();
      console.error("saveUserGoal err:", err);
      showToast("Failed to save goal", "error");
    }
  }

  // add food entry
  async function handleFoodSubmit(e, user) {
    e.preventDefault();
    const foodName = (document.getElementById("foodName")?.value || "").trim();
    const calories = parseInt(document.getElementById("calories")?.value || "", 10);
    const date = document.getElementById("date")?.value || new Date().toISOString().split("T")[0];
    const fileInput = document.getElementById("foodImage");
    const file = fileInput?.files?.[0];

    if (!foodName || Number.isNaN(calories)) {
      showToast("Please fill all fields correctly", "error");
      return;
    }

    let imageUrl = null;
    if (file) {
      showLoading();
      try {
        const filePath = `${user.id}/${Date.now()}-${file.name}`;
        const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(filePath, file);
        if (uploadErr) {
          hideLoading();
          console.error("uploadErr:", uploadErr);
          showToast("Image upload failed", "error");
          return;
        }
        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
        imageUrl = pub?.publicUrl ?? null;
      } catch (err) {
        hideLoading();
        console.error("handleFoodSubmit upload err:", err);
      } finally {
        hideLoading();
      }
    }

    try {
      showLoading();
      const { error } = await supabase.from(FOOD_TABLE).insert([{ foodName, calories, date, imageUrl, user_id: user.id }]);
      hideLoading();
      if (error) throw error;
      showToast("Food entry added!", "success");
      foodForm.reset();
      modal?.classList.add("hidden");
      await loadFoodEntries(user.id);
      await loadDailyGoalAndProgress(user);
    } catch (err) {
      hideLoading();
      console.error("Insert error:", err);
      showToast("Failed to add entry", "error");
    }
  }

  // load food entries and render
  async function loadFoodEntries(userId, filter = "all") {
    try {
      const { data, error } = await supabase.from(FOOD_TABLE).select("*").eq("user_id", userId).order("created_at", { ascending: false });
      if (error) throw error;
      const arr = Array.isArray(data) ? data : [];
      const filtered = filterEntriesByTime(arr, filter);
      renderFoodList(filtered);
      updateStats(filtered);
      renderCalorieChart(filtered);
    } catch (err) {
      console.error("loadFoodEntries err:", err);
      foodList.innerHTML = `<p class="text-center text-gray-500 p-4">Failed to load entries.</p>`;
    }
  }

  // safe filter by week/month/all
  function filterEntriesByTime(entries = [], filterType) {
    if (!Array.isArray(entries)) return [];
    if (filterType === "all") return entries;
    const now = new Date();
    return entries.filter((entry) => {
      const dateStr = entry.date ?? entry.created_at ?? null;
      if (!dateStr) return false;
      const entryDate = new Date(dateStr);
      if (filterType === "week") {
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 7);
        return entryDate >= startOfWeek && entryDate < endOfWeek;
      }
      if (filterType === "month") {
        return entryDate.getMonth() === now.getMonth() && entryDate.getFullYear() === now.getFullYear();
      }
      return true;
    });
  }

  // render chart with Chart.js
  function renderCalorieChart(entries = []) {
    const ctx = document.getElementById("caloriesChart");
    if (!ctx) return;
    const grouped = entries.reduce((acc, e) => {
      const key = (e.date ?? e.created_at ?? "").split("T")[0] || "unknown";
      acc[key] = (acc[key] || 0) + Number(e.calories || 0);
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

  // update the summary stats and show progress
  function updateStats(items = []) {
    if (!statsContainer) return;
    if (!items.length) {
      statsContainer.innerHTML = `<div class="text-center font-bold text-gray-500">No data yet</div>`;
      return;
    }

    // compute relevant items according to userGoal
    let relevant = items;
    const now = new Date();
    if (userGoal?.goal_type === "daily") {
      relevant = items.filter((i) => {
        const d = new Date(i.date ?? i.created_at ?? "");
        return d.toDateString() === now.toDateString();
      });
    } else if (userGoal?.goal_type === "weekly") {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      relevant = items.filter((i) => new Date(i.date ?? i.created_at ?? "") >= startOfWeek);
    } else if (userGoal?.goal_type === "monthly") {
      relevant = items.filter((i) => {
        const d = new Date(i.date ?? i.created_at ?? "");
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      });
    }

    const totalCalories = relevant.reduce((sum, i) => sum + (Number(i.calories) || 0), 0);
    const averageCalories = relevant.length ? (totalCalories / relevant.length).toFixed(1) : 0;
    const goalValue = (userGoal && userGoal.goal_value) ? Number(userGoal.goal_value) : 2000;
    const progressPct = Math.min((totalCalories / goalValue) * 100, 100);

    statsContainer.innerHTML = `
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 my-4 text-center">
        <div class="bg-white p-4 rounded-xl shadow">
          <h3 class="text-gray-500 text-sm">Total Calories</h3>
          <p class="text-2xl font-bold text-green-600">${totalCalories} kcal</p>
        </div>
        <div class="bg-white p-4 rounded-xl shadow">
          <h3 class="text-gray-500 text-sm">Goal Progress (${escapeHtml(userGoal.goal_type)})</h3>
          <div class="w-full bg-gray-200 h-3 rounded-full mt-2 overflow-hidden">
            <div class="bg-emerald-500 h-3 rounded-full transition-all duration-700" style="width: ${progressPct}%;"></div>
          </div>
          <p class="text-sm mt-1 text-gray-600">${progressPct.toFixed(1)}% of goal (${goalValue} kcal)</p>
        </div>
        <div class="bg-white p-4 rounded-xl shadow">
          <h3 class="text-gray-500 text-sm">Average per Entry</h3>
          <p class="text-2xl font-bold text-blue-600">${averageCalories} kcal</p>
        </div>
      </div>
    `;
    if (progressPct >= 100) showToast(`🎉 You reached your ${userGoal.goal_type} goal!`, "success");
  }

  // render food cards + attach delete handlers
  function renderFoodList(items = []) {
    if (!foodList) return;
    if (!items.length) {
      foodList.innerHTML = `<div class="p-6 text-center text-gray-500">No food entries yet. Click "Add Food" to create one.</div>`;
      return;
    }

    const html = `
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        ${items
          .map((entry) => {
            const name = escapeHtml(entry.foodName ?? "Unknown Food");
            const d = entry.date ?? entry.created_at ?? "";
            const dateStr = escapeHtml((d || "").split("T")[0] || d);
            const calories = Number(entry.calories || 0);
            const image = escapeHtml(entry.imageUrl ?? "https://via.placeholder.com/400");
            const goalValue = (userGoal && userGoal.goal_value) ? Number(userGoal.goal_value) : 2000;
            const progress = Math.min((calories / (goalValue || 2000)) * 100, 100);
            return `
              <div class="bg-white rounded-2xl shadow-lg overflow-hidden transition duration-500 hover:scale-[1.02]">
                <img src="${image}" alt="${name}" class="w-full h-48 object-cover" />
                <div class="p-4">
                  <h2 class="text-lg font-semibold text-gray-800">${name}</h2>
                  <p class="text-gray-500 text-sm">${dateStr}</p>
                  <div class="flex items-center justify-between mt-3">
                    <div class="w-full bg-gray-200 h-2 rounded-full mr-2 overflow-hidden">
                      <div class="bg-emerald-500 h-2 rounded-full transition-all duration-700" style="width: ${progress}%;"></div>
                    </div>
                    <span class="text-gray-700 text-sm">${calories} kcal</span>
                  </div>
                  <div class="mt-4 flex justify-end">
                    <button data-id="${entry.id}" class="delete-entry text-red-600 hover:underline font-medium">Delete</button>
                  </div>
                </div>
              </div>`;
          })
          .join("")}
      </div>
    `;
    foodList.innerHTML = html;

    // delete handlers
    foodList.querySelectorAll(".delete-entry").forEach((btn) =>
      btn.addEventListener("click", async (e) => {
        const id = e.currentTarget.getAttribute("data-id");
        if (!id) return;
        try {
          showLoading();
          const { error } = await supabase.from(FOOD_TABLE).delete().eq("id", id);
          hideLoading();
          if (error) throw error;
          showToast("Entry deleted", "success");
          await loadFoodEntries(user.id);
          await loadDailyGoalAndProgress(user);
        } catch (err) {
          hideLoading();
          console.error("Delete failed:", err);
          showToast("Failed to delete", "error");
        }
      })
    );
  }

  // load daily goal and update progress bar (safe, uses FOOD_TABLE)
  async function loadDailyGoalAndProgress(user) {
    try {
      // re-fetch goal (keeps cache up to date)
      const { data: goalData, error: goalError } = await supabase.from(GOAL_TABLE).select("*").eq("user_id", user.id).eq("goal_type", "daily").single();
      if (!goalError && goalData) userGoal = goalData;

      const dailyGoal = (userGoal && userGoal.goal_value) ? Number(userGoal.goal_value) : 2000;

      // fetch today's entries with server-side range filter (safer for timezones)
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const { data: entries, error: entriesError } = await supabase
        .from(FOOD_TABLE)
        .select("calories, date, created_at")
        .eq("user_id", user.id)
        .gte("created_at", startOfDay.toISOString())
        .lte("created_at", endOfDay.toISOString());

      if (entriesError) {
        // fallback: try selecting without date range (still safe)
        console.warn("entries range query failed, trying without range:", entriesError);
        const { data: fallback, error: fallbackErr } = await supabase.from(FOOD_TABLE).select("calories, date, created_at").eq("user_id", user.id);
        if (fallbackErr || !Array.isArray(fallback)) {
          console.error("Failed to fetch entries:", fallbackErr || "no data");
          updateProgressBar(0, dailyGoal);
          return;
        }
        // filter by today client-side if needed
        const today = new Date().toISOString().split("T")[0];
        const todays = fallback.filter((row) => ((row.date ?? row.created_at) || "").split("T")[0] === today);
        const total = todays.reduce((sum, r) => sum + Number(r.calories || 0), 0);
        updateProgressBar(total, dailyGoal);
        return;
      }

      const arr = Array.isArray(entries) ? entries : [];
      if (!arr.length) {
        updateProgressBar(0, dailyGoal);
        return;
      }

      // compute total calories for today (created_at may already be restricted, extra safety)
      const todayStr = new Date().toISOString().split("T")[0];
      const todaysEntries = arr.filter((entry) => ((entry.date ?? entry.created_at) || "").split("T")[0] === todayStr);
      const totalCalories = todaysEntries.reduce((sum, e) => sum + Number(e.calories || 0), 0);

      updateProgressBar(totalCalories, dailyGoal);
    } catch (err) {
      console.error("loadDailyGoalAndProgress err:", err);
    }
  }

  // update progress bar element (supports multiple ID names)
  function updateProgressBar(totalCalories, dailyGoal) {
    const bar = document.getElementById("dailyProgress") || document.getElementById("goalProgressBar");
    const txt = document.getElementById("progressText") || document.getElementById("goalProgressText");
    const percent = dailyGoal > 0 ? Math.min((totalCalories / dailyGoal) * 100, 100) : 0;

    if (bar) {
      bar.style.transition = "width 0.7s ease-in-out";
      bar.style.width = `${percent}%`;
      // color classes: prefer tailwind-like classes, fallback to inline color
      bar.classList.remove("bg-red-500", "animate-pulse", "bg-[#10b981]");
      if (totalCalories >= dailyGoal) {
        bar.classList.add("bg-red-500", "animate-pulse");
      } else {
        try {
          bar.classList.add("bg-[#10b981]");
        } catch {
          bar.style.backgroundColor = "#10b981";
        }
      }
    }

    if (txt) txt.textContent = `${totalCalories} / ${dailyGoal} kcal`;
  }

  // single realtime subscription (food inserts/updates/deletes for this user)
  function setupRealtime(user) {
    const channelName = `foodCollection-user-${user.id}`;
    supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: FOOD_TABLE, filter: `user_id=eq.${user.id}` }, async (payload) => {
        console.log("Realtime payload:", payload);
        await loadFoodEntries(user.id);
        await loadDailyGoalAndProgress(user);
      })
      .subscribe()
      
  }
});
