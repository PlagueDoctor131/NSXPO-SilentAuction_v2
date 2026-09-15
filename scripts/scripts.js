// --- Firebase config ---
const firebaseConfig = {
    apiKey: "AIzaSyDu8hu1LSLQf6zmJ5DsnTuAosaqOX2hoSI",
    authDomain: "nsxpo-78017.firebaseapp.com",
    databaseURL: "https://nsxpo-78017-default-rtdb.firebaseio.com",
    projectId: "nsxpo-78017",
    storageBucket: "nsxpo-78017.firebasestorage.app",
    messagingSenderId: "170661972532",
    appId: "1:170661972532:web:2203124865e9f525a15861",
    measurementId: "G-59XTFSY4LQ"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let auctionPaused = false;
let allFrozen = false;
let isAdmin = false;
let auctionItems = [];
let currentMember = null;
let globalBL = false;

const logoutBtn = document.getElementById("logoutBtn");

// Member blacklist toggle
const toggleMemberBLBtn = document.getElementById("toggleMemberBL");
const memberBidInput = document.getElementById("memberBidInput");
const memberBLStatus = document.getElementById("memberBLStatus");

// Add new member declarations
const addMemberBtn = document.getElementById("addMemberBtn");
const addMemberStatus = document.getElementById("addMemberStatus");

// Global blacklist toggle declarations
const globalBLStatus = document.getElementById("globalBLStatus");
const toggleGlobalBLBtn = document.getElementById("toggleGlobalBL");

// Schedule editor declarations
const scheduleEditor = document.getElementById("scheduleEditor");
const addPhaseBtn = document.getElementById("addPhaseBtn");
const saveScheduleBtn = document.getElementById("saveScheduleBtn");
const clearScheduleBtn = document.getElementById("clearScheduleBtn");
const scheduleStatus = document.getElementById("scheduleStatus");

//Apply Schedule declarations
const banner = document.getElementById("auctionTimerBanner");
const phaseNameEl = document.getElementById("auctionPhaseName");
const phaseFlagsEl = document.getElementById("auctionPhaseFlags");
const nextLineEl = document.getElementById("auctionNextLine");
const countdownEl = document.getElementById("auctionTimerCountdown");

// Freeze all declarations
const allFreezeStatus = document.getElementById("allFreezeStatus");
const toggleAllFreezeBtn = document.getElementById("toggleAllFreeze");

// lookup overlay handler declarations
const lookupForm = document.getElementById('lookupForm');
const bidInput = document.getElementById('bidInput');
const lookupError = document.getElementById('lookupError');
const lookupOverlay = document.getElementById('lookupOverlay');

const Index_VERSION = "4";
function setBidControlsHidden(hidden) {
    document.querySelectorAll("input[id$='-amount']").forEach(inp => {
        inp.disabled = hidden;
        inp.style.display = hidden ? "none" : "inline-block";
    });
    document.querySelectorAll("button").forEach(btn => {
        if (btn.textContent.trim().toLowerCase() === "submit bid") {
            btn.disabled = hidden;
            btn.style.display = hidden ? "none" : "inline-block";
        }
    });
}

function showBlacklistBanner(text) {
    const banner = document.getElementById("blacklistBanner");
    const span = document.getElementById("blacklistBannerText");
    if (span && text) span.textContent = text;
    banner.style.display = "block";
}

function hideBlacklistBanner() {
    const banner = document.getElementById("blacklistBanner");
    banner.style.display = "none";
}
// Formats the time into a readable format.
function fmtDiff(ms) {
    if (ms <= 0) return "0:00:00";
    const days = Math.floor(ms / 86400000);
    const hrs = Math.floor((ms % 86400000) / 3600000);
    const mins = Math.floor((ms % 3600000) / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${days} Days, ${hrs} Hours, ${mins.toString().padStart(2, "0")} Minutes, ${secs.toString().padStart(2, "0")} Seconds`;
}
// --- Force refresh listener ---
db.ref("settings/forceRefresh").on("value", snap => {
    const val = snap.val();
    if (val) {
        console.log("🔄 Refresh triggered:", val);

        db.ref("settings/forceRefresh").set(null).then(() => {
            window.location.reload();
        });
    }
});
function autofillMemberFields() {
    if (!currentMember) return;
    auctionItems.forEach(item => {
        const first = document.getElementById(`${item.id}-firstName`);
        const last = document.getElementById(`${item.id}-lastName`);
        const bid = document.getElementById(`${item.id}-bidNumber`);
        if (first) first.value = currentMember.firstName;
        if (last) last.value = currentMember.lastName;
        if (bid) bid.value = currentMember.bidNumber;
    });
}

// Button function for logging out the user, clears local storage
function logoutMember() {
    currentMember = null;
    localStorage.removeItem("bidNumber");
    lookupOverlay.classList.remove("hidden");
    logoutBtn.style.display = "none";

    auctionItems.forEach(item => {
        ["firstName", "lastName", "bidNumber"].forEach(f => {
            const el = document.getElementById(`${item.id}-${f}`);
            if (el) el.value = "";
        });
    });
}

logoutBtn.addEventListener("click", logoutMember);

function onMemberLoaded(member) {
    currentMember = member;

    localStorage.setItem("bidNumber", member.bidNumber);
    lookupOverlay.classList.add("hidden");
    logoutBtn.style.display = "inline-block";

    autofillMemberFields();
    watchMemberBlacklist(member.bidNumber);
}

// SHA-256 helper
async function hashPassword(password) {
    const buf = new TextEncoder().encode(password);
    const hashBuf = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, "0")).join("");
}
async function getStoredHash() {
    const snap = await db.ref("admin/passwordHash").once("value");
    return snap.val();
}
async function loginAdmin() {
    const pw = document.getElementById("admin-password").value;
    const h = await hashPassword(pw);
    const stored = await getStoredHash();
    const status = document.getElementById("admin-status");
    if (h === stored) {
        isAdmin = true;
        status.textContent = "Admin privileges granted.";
        document.getElementById("admin-login").style.display = "none";
        showAdminControls();

    } else {
        status.textContent = "Incorrect password.";
        status.style.color = "red";
    }
}
function showAdminControls() {
    document.querySelectorAll(".admin-btn").forEach(b => b.style.display = "inline-block");
    document.getElementById("admin-panel").style.display = "block";
}

function refreshGlobalBL() {
    db.ref("settings/blacklistActive").once("value").then(snap => {
        const active = !!snap.val();
        globalBL = active;
        globalBLStatus.textContent = active ? "ON" : "OFF";


    });
}


toggleGlobalBLBtn.addEventListener("click", () => {
    db.ref("settings/blacklistActive").once("value").then(snap => {
        const current = !!snap.val();
        db.ref("settings/blacklistActive").set(!current).then(refreshGlobalBL);
        db.ref("settings/forceRefresh").set(Date.now());
    });
});

refreshGlobalBL();
function watchMemberBlacklist(bidNumber) {
    const memberRef = db.ref(`members/${bidNumber}/blacklisted`);
    memberRef.on("value", snap => {
        const isBL = !!snap.val();
        if (globalBL && isBL) {
            alert("You are no longer allowed to bid.");
            showBlacklistBanner("Thank you for participating in the pre-event auction. Bidding is now closed for non-attendees.");
            setBidControlsHidden(true);
            logoutMember();
            memberRef.off(); // stop listening after logout
        }
    });
}
function createImageCarousel(images, itemId) {
    let currentIndex = 0;
    const wrapper = document.createElement("div");
    wrapper.className = "carousel";

    const img = document.createElement("img");
    img.src = images[currentIndex];
    wrapper.appendChild(img);

    if (images.length > 1) {
        const leftBtn = document.createElement("button");
        leftBtn.textContent = "◀";
        leftBtn.className = "carousel-btn left";
        leftBtn.onclick = () => {
            currentIndex = (currentIndex - 1 + images.length) % images.length;
            console.log("Switched left to", currentIndex, images[currentIndex]); // DEBUG
            img.src = images[currentIndex];
        };

        const rightBtn = document.createElement("button");
        rightBtn.textContent = "▶";
        rightBtn.className = "carousel-btn right";
        rightBtn.onclick = () => {
            currentIndex = (currentIndex + 1) % images.length;
            console.log("Switched right to", currentIndex, images[currentIndex]); // DEBUG
            img.src = images[currentIndex];
        };

        wrapper.appendChild(leftBtn);
        wrapper.appendChild(rightBtn);
    }

    return wrapper;
}
toggleMemberBLBtn.addEventListener("click", () => {

    const bid = memberBidInput.value.trim();
    if (!bid) { alert("Enter a bid number"); return; }

    const memberRef = db.ref(`members/${bid}`);

    memberRef.once("value")
        .then(snap => {
            if (!snap.exists()) throw new Error(`Member ${bid} not found.`);
            const currentBlacklisted = !!snap.val().blacklisted;
            const toggled = !currentBlacklisted;
            return memberRef.child("blacklisted").set(toggled).then(() => toggled);
        })
        .then(toggled => {
            memberBLStatus.textContent = `Member ${bid} is now ${toggled ? "BLACKLISTED" : "ACTIVE"}`;
            refreshGlobalBL();
        })
        .catch(err => {
            memberBLStatus.textContent = "Error: " + err.message;
        });


});


// --- Export CSV ---
function exportBiddingHistory() {
    const header = ["itemId", "bidNum", "firstName", "lastName", "contactNumber", "amtBid"];
    const rows = [header.join(",")];

    const promises = auctionItems.map(item => {
        return db.ref(`bids/${item.id}/history`).once("value").then(snap => {
            const history = snap.val() || [];

            // Fetch all member records for this item's history
            const memberLookups = history.map(bid => {
                if (!bid.bidNumber) return Promise.resolve(); // skip if malformed

                return db.ref(`members/${bid.bidNumber}`).once("value").then(memSnap => {
                    const member = memSnap.val() || {};
                    const phone = member.contactNumber || "";

                    rows.push([
                        item.id,
                        bid.bidNumber,
                        bid.firstName || "",
                        bid.lastName || "",
                        phone,
                        bid.amount
                    ].join(","));
                });
            });

            return Promise.all(memberLookups);
        });
    });

    Promise.all(promises).then(() => {
        const csvContent = rows.join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "bidding_history.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
}

document.getElementById("exportCSVBtn").addEventListener("click", exportBiddingHistory);

// Reuse helpers
function formatDiff(ms) {
    const hrs = Math.floor(ms / 3600000);
    const mins = Math.floor((ms % 3600000) / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function setBiddingEnabled(enabled) {
    document.querySelectorAll("button").forEach(btn => {
        if (btn.textContent.trim().toLowerCase() === "submit bid") {
            btn.disabled = !enabled;
        }
    });
    document.querySelectorAll("input[id$='-amount']").forEach(inp => {
        inp.disabled = !enabled;
        inp.style.opacity = enabled ? "1" : ".6";
    });
}
function isoLocalFromMs(ms) {
    if (!ms) return "";
    const d = new Date(ms);
    const pad = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

addMemberBtn.addEventListener("click", () => {
    const bid = document.getElementById("newBidNum").value.trim();
    const first = document.getElementById("newFirstName").value.trim();
    const last = document.getElementById("newLastName").value.trim();
    const email = document.getElementById("newEmail").value.trim();
    const phone = document.getElementById("newPhone").value.trim();

    if (!bid || !first || !last || !email || !phone) {
        addMemberStatus.textContent = "Please fill in all fields.";
        return;
    }


    const digits = phone.replace(/\D/g, "");
    if (digits.length < 7) {
        addMemberStatus.textContent = "Please enter a valid phone number.";
        return;
    }

    const ref = db.ref(`members/${bid}`);

    ref.once("value")
        .then(snap => {
            if (snap.exists()) throw new Error(`Bid number ${bid} is already in use.`);
            return ref.set({
                firstName: first,
                lastName: last,
                contactEmail: email,
                contactNumber: phone,
                blacklisted: false
            });
        })
        .then(() => {
            addMemberStatus.textContent = `Member ${first} ${last} (Bid #${bid}) added.`;
            document.getElementById("newBidNum").value = "";
            document.getElementById("newFirstName").value = "";
            document.getElementById("newLastName").value = "";
            document.getElementById("newEmail").value = "";
            document.getElementById("newPhone").value = "";
        })
        .catch(err => {
            addMemberStatus.textContent = "Error: " + err.message;
        });
});

function createPhaseRow(phase = {}) {
    const div = document.createElement("div");
    div.className = "phase-row";
    div.innerHTML = `
        <div class="line">
          <label for="">Phase Name:
            <input type="text" class="phase-name" placeholder="e.g., Preview" value="${phase.phase ? phase.phase.replace(/"/g, '&quot;') : ""}">
          </label>
        </div>
        <div class="line">
          <label for="">Start:
            <input type="datetime-local" class="phase-start" value="${phase.start ? isoLocalFromMs(phase.start) : ""}">
          </label>
          <label for="">End:
            <input type="datetime-local" class="phase-end" value="${phase.end ? isoLocalFromMs(phase.end) : ""}">
          </label>
        </div>
        <div class="line">
          <label><input type="checkbox" class="phase-bid" ${phase.biddingAllowed ? "checked" : ""}> Bidding Allowed</label>
          <label><input type="checkbox" class="phase-bl" ${phase.blacklistActive ? "checked" : ""}> Enable Blacklist</label>
          <label>
  Reminder Hours:
  <input type="number" class="phase-reminder" min="0" value="${phase.reminderHours || 0}">
</label>

        </div>
        <button type="button" class="removePhaseBtn">Remove Phase</button>
      `;
    div.querySelector(".removePhaseBtn").onclick = () => div.remove();
    scheduleEditor.appendChild(div);
}

addPhaseBtn.addEventListener("click", () => createPhaseRow());

// Load existing schedule into editor
db.ref("settings/auctionSchedule").once("value").then(snap => {
    const phases = snap.val() || [];
    if (!phases.length) {
        // Provide some starter rows (optional)
        createPhaseRow({ phase: "Preview", biddingAllowed: false, blacklistActive: false });
        createPhaseRow({ phase: "Auction 1", biddingAllowed: true, blacklistActive: false });
    } else {
        phases.forEach(p => createPhaseRow(p));
    }
});


saveScheduleBtn.addEventListener("click", () => {
    const rows = Array.from(scheduleEditor.querySelectorAll(".phase-row"));
    const phases = [];

    for (const row of rows) {
        const name = row.querySelector(".phase-name").value.trim();
        const startStr = row.querySelector(".phase-start").value;
        const endStr = row.querySelector(".phase-end").value;
        const biddingAllowed = row.querySelector(".phase-bid").checked;
        const blacklistActive = row.querySelector(".phase-bl").checked;
        const reminderHours = parseInt(row.querySelector(".phase-reminder").value, 10) || 0;

        if (!name || !startStr) continue;
        const start = new Date(startStr).getTime();
        const end = endStr ? new Date(endStr).getTime() : null;

        if (isNaN(start)) continue;
        if (endStr && (isNaN(end) || end <= start)) {
            scheduleStatus.textContent = "⚠ Each phase's end must be after its start.";
            return;
        }

        phases.push({ phase: name, start, end, biddingAllowed, blacklistActive, reminderHours });
    }

    db.ref("settings/auctionSchedule").set(phases).then(() => {
        scheduleStatus.textContent = "✅ Schedule saved!";
    });
});



// Clear schedule
clearScheduleBtn.addEventListener("click", () => {
    db.ref("settings/auctionSchedule").remove().then(() => {
        scheduleStatus.textContent = "⏹ Schedule cleared.";
        scheduleEditor.innerHTML = "";
    });
});

function findActivePhase(phases, now) {
    const grace = 1000;
    return phases.find(p =>
        p.start <= now &&
        (p.end == null || now <= p.end + grace)  // <= instead of <
    ) || null;
}

function findNextPhase(phases, now) {
    // Next is the earliest with start > now
    const future = phases.filter(p => p.start > now);
    future.sort((a, b) => a.start - b.start);
    return future[0] || null;
}

// Live updater
db.ref("settings/auctionSchedule").on("value", snap => {
    const phases = snap.val() || [];

    function tick() {
        const now = Date.now();
        if (!phases.length) {
            console.log("⏱ No phases at all → hiding banner");
            banner.style.display = "none";
            setBiddingEnabled(false);
            return;
        }


        // Try to find an active phase
        const active = findActivePhase(phases, now);
        const next = findNextPhase(phases, now);

        if (active) {
            console.log("⏱ Active phase:", active.phase,
                "start:", new Date(active.start).toLocaleTimeString(),
                "end:", active.end ? new Date(active.end).toLocaleTimeString() : "open");
            // Show active phase with countdown to its end (if present)
            banner.style.display = "block";
            phaseNameEl.textContent = `${active.phase}`;
            phaseFlagsEl.textContent = " ";

            if (active.end) {
                const diff = active.end - now;
                countdownEl.textContent = diff > 0 ? `Ends in ${fmtDiff(diff)}` : "Ended";
            } else {
                countdownEl.textContent = "No scheduled end";
            }

            // --- Enforce rules correctly ---
            const blOn = !!active.blacklistActive || globalBL;
            const biddingOpen = !!active.biddingAllowed && now >= active.start;
            const memberBlocked = blOn && !!(currentMember && currentMember.blacklisted);

            setBiddingEnabled(biddingOpen && !memberBlocked);
            setBidControlsHidden(memberBlocked);

            if (memberBlocked) {
                showBlacklistBanner(
                    "Thank you for participating in the pre-event auction. Bidding is now closed for non-attendees."
                );
            } else {
                hideBlacklistBanner();
            }


            // Show next phase preview if exists
            if (next) {
                nextLineEl.textContent = ``;
            } else {
                nextLineEl.textContent = "";
            }
        } else {
            if (next) {
                banner.style.display = "block";
                phaseNameEl.textContent = `Next auction is on ${new Date(next.start).toLocaleString()}`;
                phaseFlagsEl.textContent = ""; // no flags now
                countdownEl.textContent = `Starts in ${fmtDiff(next.start - now)}`;
                nextLineEl.textContent = "";
                setBiddingEnabled(false);
            } else {
                // No active and no upcoming phases
                banner.style.display = "block";
                phaseNameEl.textContent = " Auction has ended!";
                phaseFlagsEl.textContent = "";
                countdownEl.textContent = "";
                nextLineEl.textContent = " Thank you for bidding!";
                setBiddingEnabled(false);
            }
        }
        // --- Reminder logic ---
        const reminderBanner = document.getElementById("auctionReminderBanner");
        const reminderText = document.getElementById("auctionReminderText");
        const dismissBtn = document.getElementById("dismissReminderBtn");

        if (active && active.end && active.biddingAllowed && Number(active.reminderHours) > 0) {
            const reminderMs = Number(active.reminderHours) * 60 * 60 * 1000;
            const timeLeft = active.end - now;

            const reminderKey = `auctionReminder:${active.phase}:${active.end}`;
            const dismissed = localStorage.getItem(reminderKey) === "dismissed";

            if (!dismissed && timeLeft > 0 && timeLeft <= reminderMs) {
                reminderText.textContent =
                    `⚡ Only ${fmtDiff(timeLeft)} left in the ${active.phase}! Place your final bids.`;
                reminderBanner.style.display = "block";
                dismissBtn.onclick = () => {
                    localStorage.setItem(reminderKey, "dismissed");
                    reminderBanner.style.display = "none";
                };
            } else {
                reminderBanner.style.display = "none";
            }
        } else {
            reminderBanner.style.display = "none";
        }


    }

    tick();
    clearInterval(window._scheduleTick);
    window._scheduleTick = setInterval(tick, 1000);
});

function refreshAllFreeze() {
    db.ref("settings/allFrozen").once("value").then(snap => {
        allFrozen = !!snap.val();
        allFreezeStatus.textContent = allFrozen ? "Paused" : "ACTIVE";
    });
}

toggleAllFreezeBtn.addEventListener("click", () => {
    db.ref("settings/allFrozen").once("value").then(snap => {
        const current = !!snap.val();
        return db.ref("settings/allFrozen").set(!current);
    }).then(refreshAllFreeze);
});

refreshAllFreeze();

// Keep listening for changes in real-time
db.ref("settings/allFrozen").on("value", snap => {
    allFrozen = !!snap.val();
    allFreezeStatus.textContent = allFrozen ? "Paused" : "ACTIVE";
});

function toggleFreeze(itemId) {
    if (!isAdmin) return;
    const ref = db.ref(`bids/${itemId}/frozen`);
    ref.once("value").then(s => ref.set(!s.val()));
}

function removeLastBid(itemId) {
    if (!isAdmin) return;
    const ref = db.ref(`bids/${itemId}`);
    ref.once("value").then(s => {
        const data = s.val() || {};
        const hist = data.history || [];
        hist.pop();
        const prev = hist[hist.length - 1] || null;
        if (prev) {
            ref.set({ current: prev, history: hist, frozen: data.frozen || false });
        } else {
            ref.remove();
        }
    });
}

// load member info
function loadMember(bidNumber) {
    return Promise.all([
        db.ref(`members/${bidNumber}`).once('value'),
        db.ref('settings/blacklistActive').once('value')
    ]).then(([memberSnap, globalSnap]) => {
        const memberData = memberSnap.val();
        globalBL = !!globalSnap.val();
        if (!memberData) throw new Error("Unknown Bid Number");
        if (globalBL && memberData.blacklisted) throw new Error("You are no longer allowed to bid.");
        return {
            bidNumber,
            firstName: memberData.firstName,
            lastName: memberData.lastName,
            email: memberData.email,
            phone: memberData.phone || "",
            blacklisted: !!memberData.blacklisted
        };
    });
}

lookupForm.addEventListener('submit', e => {
    e.preventDefault();
    lookupError.textContent = '';
    const bid = bidInput.value.trim();
    loadMember(bid)
        .then(member => onMemberLoaded(member))
        .catch(err => { lookupError.textContent = err.message; });
});

window.addEventListener("DOMContentLoaded", () => {
    const savedBid = localStorage.getItem("bidNumber");
    if (savedBid) {
        loadMember(savedBid)
            .then(member => onMemberLoaded(member))
            .catch(() => {
                localStorage.removeItem("bidNumber");
            });
    }
});

function submitBid(e, itemId) {
    e.preventDefault();

    if (!currentMember) return alert("Please enter your bid number first.");
    if (allFrozen) return alert("All auctions are currently frozen.");
    refreshGlobalBL();
    if (globalBL && currentMember.blacklisted) return alert("You are no longer allowed to bid.");
    if (auctionPaused) return alert("Bidding is currently paused. Please wait until the auction reopens.");


    const amt = parseFloat(document.getElementById(`${itemId}-amount`).value);
    if (isNaN(amt)) return alert("Please enter a valid bid amount.");

    const ref = db.ref(`bids/${itemId}`);
    const itemData = auctionItems.find(i => i.id === itemId);
    const startBid = parseFloat(itemData.startingBid);

    ref.once("value").then(snap => {
        const data = snap.val() || {};
        const hist = data.history || [];
        const current = data.current;

        if (data.frozen) return alert("Bidding closed for this item.");
        if (!current && amt < startBid) return alert(`First bid must be at least $${startBid}.`);
        if (current && amt <= current.amount) return alert("Bid must exceed current highest bid.");


        const newBid = {
            firstName: currentMember.firstName,
            lastName: currentMember.lastName,
            bidNumber: currentMember.bidNumber,
            amount: amt,
            timestamp: Date.now()
        };

        hist.push(newBid);


        return ref.set({ current: newBid, history: hist, frozen: false })
            .then(() => {

                document.getElementById(`${itemId}-amount`).value = "";

                // Show success message
                const successEl = document.getElementById(`${itemId}-success`);
                if (successEl) {
                    successEl.textContent = "Bid submitted successfully!";
                    setTimeout(() => { successEl.textContent = ""; }, 3000);
                }
            });
    })
        .catch(err => alert(err.message));
}

// render items
function renderItems() {
    const container = document.getElementById("items");
    container.innerHTML = "";
    auctionItems.forEach(item => {
        const card = document.createElement("details");
        card.className = "item";

        const summary = document.createElement("summary");

        // Create carousel for this item
        const imgCarousel = createImageCarousel(item.images || [item.img], item.id);
        summary.appendChild(imgCarousel);

        // Create info container
        const info = document.createElement("div");
        info.className = "item-info";
        info.innerHTML = `
  <span class="title"><strong>${item.name}</strong></span>
  <span id="${item.id}-current" class="top-bid">Loading…</span>
`;
        summary.appendChild(info);

        card.appendChild(summary);



        const expanded = document.createElement("div");
        expanded.className = "expanded";
        expanded.innerHTML = `
        
        <p><strong>Donated by:</strong> ${item.dono}</p>
        <p>${item.desc}</p>
        <p><strong>Retail Value:</strong> ${item.retailValue && Number(item.retailValue) !== 0
                ? `$${item.retailValue}`
                : "Event Exclusive"}</p>

        <p><strong>Current Top Bid:</strong> <span id="${item.id}-expandedTop">Loading…</span></p>
        <p><strong>Total Bids:</strong> <span id="${item.id}-total">0</span></p>
        <form onsubmit="submitBid(event, '${item.id}')">
          <input type="text" value="" placeholder="First Name" id="${item.id}-firstName" readonly>
          <input type="text" value="" placeholder="Last Name" id="${item.id}-lastName" readonly>
          <input type="text" value="" placeholder="Bid Number" id="${item.id}-bidNumber" readonly>
          <input type="number" id="${item.id}-amount" placeholder="Your bid" required>
          <button>Submit Bid</button>
        </form>
        <p id="${item.id}-success" style="color:green; font-size:0.9em; min-height:1em;"></p>
        <details>
          <summary>Bid History</summary>
          <ul id="${item.id}-history"></ul>
        </details>
        <button class="admin-btn" onclick="removeLastBid('${item.id}')">Remove Last Bid</button>
        <button class="admin-btn" id="${item.id}-freeze-btn" onclick="toggleFreeze('${item.id}')">Freeze Bidding</button>
      `;
        card.appendChild(expanded);
        container.appendChild(card);

        // subscribe to bid updates
        db.ref(`bids/${item.id}`).on("value", snap => {
            const data = snap.val() || {};
            const hist = data.history || [];
            const cur = data.current || null;
            const frozen = data.frozen || false;
            const topEl = document.getElementById(`${item.id}-current`);
            const expandedTopEl = document.getElementById(`${item.id}-expandedTop`);
            if (cur) {
                topEl.innerHTML = `<br><strong>Top Bidder:</strong> ${cur.firstName} ${cur.lastName}`;
                expandedTopEl.textContent = `$${cur.amount} by ${cur.firstName} ${cur.lastName}`;
            } else {
                topEl.innerHTML = `<br><strong>Minimum Bid:</strong> $${item.startingBid}`;
                expandedTopEl.textContent = "No bids yet";
            }
            document.getElementById(`${item.id}-total`).textContent = hist.length;
            document.getElementById(`${item.id}-history`).innerHTML =
                hist.map(b => `<li>$${b.amount} by ${b.firstName} ${b.lastName} at ${new Date(b.timestamp).toLocaleTimeString()}</li>`).join("");
            ["firstName", "lastName", "bidNumber", "amount"].forEach(f => {
                const el = document.getElementById(`${item.id}-${f}`);
                if (el) el.disabled = frozen;
            });
            const btn = document.getElementById(`${item.id}-freeze-btn`);
            btn.textContent = frozen ? "Unfreeze Bidding" : "Freeze Bidding";

            // autofill readonly fields if logged in
            if (currentMember) {
                document.getElementById(`${item.id}-firstName`).value = currentMember.firstName;
                document.getElementById(`${item.id}-lastName`).value = currentMember.lastName;
                document.getElementById(`${item.id}-bidNumber`).value = currentMember.bidNumber;
            }

            if (isAdmin) showAdminControls();
        });
    });
}

// load items
fetch("items.json?v=" + Index_VERSION)
    .then(r => r.json())
    .then(data => {
        auctionItems = data;
        renderItems();
    })
    .catch(err => console.error("Failed to load items:", err));

// restore member if saved
window.addEventListener("DOMContentLoaded", () => {
    const savedBid = localStorage.getItem("bidNumber");
    if (savedBid) {
        loadMember(savedBid)
            .then(member => {
                currentMember = member;
                lookupOverlay.classList.add("hidden");
            })
            .catch(() => {
                localStorage.removeItem("bidNumber");
            });
    }
});