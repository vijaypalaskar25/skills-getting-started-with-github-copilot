document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");

  // Helper: derive 1-2 character initials from an email local-part
  function getInitials(email) {
    const local = (email || "").split("@")[0] || "";
    const parts = local.split(/[\.\-_]/).filter(Boolean);
    const initials = parts.length === 0 ? local.slice(0, 2) : parts.map(p => p[0]).slice(0, 2).join("");
    return (initials || local.slice(0, 2)).toUpperCase();
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";
      // Reset activity select options (keep the placeholder)
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft = details.max_participants - details.participants.length;

        // Build participants HTML: chips with avatar initials + email, or a "no participants" message
        const participantsHtml = details.participants && details.participants.length
          ? `<div class="participants">
               <h5>Participants (${details.participants.length})</h5>
               <ul class="participants-list">
                 ${details.participants
                   .map(p => `<li>
                                <span class="avatar">${getInitials(p)}</span>
                                <span class="email">${p}</span>
                                <button class="remove-btn" data-activity="${encodeURIComponent(name)}" data-email="${p}" title="Unregister ${p}" aria-label="Unregister ${p}">✖</button>
                              </li>`)
                   .join("")}
               </ul>
             </div>`
          : `<div class="participants">
               <h5>Participants (0)</h5>
               <p class="no-participants">No participants yet</p>
             </div>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          ${participantsHtml}
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });
    } catch (error) {
      activitiesList.innerHTML = "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        signupForm.reset();
        // Refresh activities so the newly signed-up participant appears immediately
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to sign up. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error signing up:", error);
    }
  });

  // Delegated click handler for remove buttons next to participants
  document.addEventListener("click", async (event) => {
    const target = event.target;
    if (!target.classList || !target.classList.contains("remove-btn")) return;

    const email = target.dataset.email;
    const activity = decodeURIComponent(target.dataset.activity || "");

    if (!email || !activity) return;

    // Confirm action with user
    if (!confirm(`Unregister ${email} from ${activity}?`)) return;

    try {
      const res = await fetch(
        `/activities/${encodeURIComponent(activity)}/participants?email=${encodeURIComponent(email)}`,
        { method: "DELETE" }
      );

      const result = await res.json();

      if (res.ok) {
        // Refresh activities to reflect change
        fetchActivities();
        messageDiv.textContent = result.message || `${email} removed`;
        messageDiv.className = "info";
        messageDiv.classList.remove("hidden");
        setTimeout(() => messageDiv.classList.add("hidden"), 4000);
      } else {
        messageDiv.textContent = result.detail || "Failed to remove participant";
        messageDiv.className = "error";
        messageDiv.classList.remove("hidden");
      }
    } catch (err) {
      console.error("Error removing participant:", err);
      messageDiv.textContent = "Failed to remove participant. Try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
    }
  });

  // Initialize app
  fetchActivities();
});
