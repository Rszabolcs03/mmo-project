import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import {
  collection,
  getDocs,
  getFirestore,
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCn-vwqYoMMfvsclogtkiCY5vvp_9OjB4k",
  authDomain: "mmo-project-a4975.firebaseapp.com",
  projectId: "mmo-project-a4975",
  storageBucket: "mmo-project-a4975.firebasestorage.app",
  messagingSenderId: "685143349143",
  appId: "1:685143349143:web:91e0be311554a974a496d2",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const form = document.querySelector("#auth-form");
const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");
const registerButton = document.querySelector("#register-button");
const authStatus = document.querySelector("#auth-status");
const dashboard = document.querySelector("#account-dashboard");
const accountEmail = document.querySelector("#account-email");
const accountMeta = document.querySelector("#account-meta");
const logoutButton = document.querySelector("#logout-button");
const resetButton = document.querySelector("#reset-button");
const verifyButton = document.querySelector("#verify-button");
const verificationStatus = document.querySelector("#verification-status");
const characterList = document.querySelector("#character-list");

function setStatus(message) {
  authStatus.textContent = message;
}

function showDashboard(user) {
  form.classList.add("hidden");
  dashboard.classList.remove("hidden");
  accountEmail.textContent = user.email || "Wayworn account";
  accountMeta.textContent = `User ID: ${user.uid}`;
  verificationStatus.textContent = user.emailVerified
    ? "Your email is verified."
    : "Your email is not verified yet. The game may ask you to verify before playing.";
  verifyButton.disabled = user.emailVerified;
}

function showLogin(message = "Login with your Wayworn account.") {
  dashboard.classList.add("hidden");
  form.classList.remove("hidden");
  setStatus(message);
}

function characterSubtitle(character) {
  const race = character.raceId || character.race || "unknown race";
  const characterClass = character.classId || character.className || character.class || "unknown class";
  return `${race} ${characterClass}`;
}

function characterLevel(character) {
  return Number(character.level || 1);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderCharacters(characters) {
  if (!characters.length) {
    characterList.innerHTML = '<p class="status-text">No cloud characters found for this account yet.</p>';
    return;
  }

  characterList.innerHTML = characters.map((character) => {
    const name = character.name || "Unnamed Hero";
    const level = characterLevel(character);
    const updated = character.cloudUpdatedAt?.toDate
      ? character.cloudUpdatedAt.toDate().toLocaleString("en-GB", {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "Unknown";
    return `
      <article class="character-card">
        <div class="character-main">
          <strong>${escapeHtml(name)}</strong>
          <span>${escapeHtml(characterSubtitle(character))}</span>
        </div>
        <div class="character-meta">
          <span class="level-pill">Level ${escapeHtml(level)}</span>
          <small>${escapeHtml(updated)}</small>
        </div>
      </article>
    `;
  }).join("");
}

async function loadCharacters(user) {
  characterList.innerHTML = '<p class="status-text">Loading characters...</p>';
  try {
    const snapshot = await getDocs(collection(db, "users", user.uid, "characters"));
    const characters = snapshot.docs.map((characterDoc) => ({ id: characterDoc.id, ...characterDoc.data() }));
    characters.sort((a, b) => Number(b.level || 1) - Number(a.level || 1));
    renderCharacters(characters);
  } catch (error) {
    characterList.innerHTML = `<p class="status-text">Could not load characters: ${escapeHtml(error.message)}</p>`;
  }
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    showLogin();
    return;
  }

  showDashboard(user);
  await loadCharacters(user);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  try {
    setStatus("Logging in...");
    await signInWithEmailAndPassword(auth, email, password);
    passwordInput.value = "";
  } catch (error) {
    setStatus(error.message);
  }
});

registerButton.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || password.length < 6) {
    setStatus("Enter an email and a password with at least 6 characters.");
    return;
  }

  try {
    setStatus("Creating account...");
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await sendEmailVerification(credential.user);
    setStatus("Account created. Verification email sent.");
    passwordInput.value = "";
  } catch (error) {
    setStatus(error.message);
  }
});

logoutButton.addEventListener("click", async () => {
  await signOut(auth);
});

resetButton.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user?.email) return;
  await sendPasswordResetEmail(auth, user.email);
  accountMeta.textContent = `Password reset email sent to ${user.email}`;
});

verifyButton.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user || user.emailVerified) return;
  await sendEmailVerification(user);
  accountMeta.textContent = `Verification email sent to ${user.email}`;
});
