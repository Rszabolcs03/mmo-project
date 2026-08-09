/* Shared site behavior: version stamping, mobile nav, scroll reveal,
   and the interactive class explorer on the home page.
   Class/ability data mirrors src/game/gameData.js — keep in sync by hand. */

const SITE = {
  version: "0.3.76",
  platform: "Windows",
  downloadUrl: "https://www.mediafire.com/file/fim46sxz5exteya/Top-Down_MMO_Prototype_Setup.exe/file",
};

const CLASSES = [
  {
    id: "mage",
    name: "Mage",
    resource: "Mana",
    accent: "var(--class-mage)",
    sprite: "./assets/mage.png",
    blurb:
      "A ranged caster built around burst spells and battlefield control. Freeze packs in place, then burn them down from range.",
    specs: [
      { name: "Frostbinder", role: "Damage" },
      { name: "Firecaller", role: "Damage" },
    ],
    abilities: [
      { level: 1, name: "Firebolt" },
      { level: 1, name: "Frost Nova" },
      { level: 4, name: "Arcane Lance" },
      { level: 8, name: "Meteor Ring" },
      { level: 12, name: "Ice Prison" },
      { level: 16, name: "Star Surge" },
    ],
  },
  {
    id: "hunter",
    name: "Hunter",
    resource: "Mana",
    accent: "var(--class-hunter)",
    sprite: "./assets/hunter.png",
    blurb:
      "A ranged fighter with a loyal pet at their side. Lay traps, kite dangerous enemies, and finish them with a well-placed Deadeye.",
    specs: [
      { name: "Sharpshooter", role: "Damage" },
      { name: "Wildstalker", role: "Damage" },
    ],
    abilities: [
      { level: 1, name: "Piercing Shot" },
      { level: 1, name: "Trap" },
      { level: 4, name: "Rapid Arrow" },
      { level: 8, name: "Explosive Trap" },
      { level: 12, name: "Volley" },
      { level: 16, name: "Deadeye" },
    ],
  },
  {
    id: "paladin",
    name: "Paladin",
    resource: "Mana",
    accent: "var(--class-paladin)",
    sprite: "./assets/paladin.png",
    blurb:
      "A holy knight who holds the front line. Shield yourself through the worst of it, or take the Verdict oath and hit like a falling star.",
    specs: [
      { name: "Oath of the Verdict", role: "Damage" },
      { name: "Aegis of Dawn", role: "Tank" },
    ],
    abilities: [
      { level: 1, name: "Holy Strike" },
      { level: 1, name: "Divine Shield" },
      { level: 4, name: "Judgement" },
      { level: 8, name: "Consecration" },
      { level: 12, name: "Hammer Toss" },
      { level: 16, name: "Radiant Burst" },
    ],
  },
  {
    id: "warrior",
    name: "Warrior",
    resource: "Fury",
    accent: "var(--class-warrior)",
    sprite: "./assets/warrior.png",
    blurb:
      "A melee bruiser powered by Fury, generated in the thick of combat. Cleave through packs or become the Iron Ward your group hides behind.",
    specs: [
      { name: "Blood Fury", role: "Damage" },
      { name: "Iron Ward", role: "Tank" },
    ],
    abilities: [
      { level: 1, name: "Cleave" },
      { level: 1, name: "Battle Shout" },
      { level: 4, name: "Charge Slash" },
      { level: 8, name: "Whirlwind" },
      { level: 12, name: "Ground Breaker" },
      { level: 16, name: "Execute" },
    ],
  },
  {
    id: "priest",
    name: "Priest",
    resource: "Mana",
    accent: "var(--class-priest)",
    sprite: "./assets/priest.png",
    blurb:
      "A wielder of light and shadow. Embrace the Light to keep your party standing, or enter the Void and unmake your enemies instead.",
    specs: [
      { name: "Embrace the Light", role: "Healer" },
      { name: "Enter the Void", role: "Damage" },
    ],
    abilities: [
      { level: 1, name: "Smite" },
      { level: 1, name: "Holy Nova" },
      { level: 4, name: "Mind Spike" },
      { level: 8, name: "Sanctuary" },
      { level: 12, name: "Penance" },
      { level: 16, name: "Divine Wrath" },
    ],
  },
  {
    id: "rogue",
    name: "Rogue",
    resource: "Energy",
    accent: "var(--class-rogue)",
    sprite: "./assets/rogue.png",
    blurb:
      "A fast, Energy-driven skirmisher. Vanish into smoke, open from Ambush, and end fights before the enemy knows they started.",
    specs: [
      { name: "Assassin", role: "Damage" },
      { name: "Shadow", role: "Damage" },
    ],
    abilities: [
      { level: 1, name: "Quick Stab" },
      { level: 1, name: "Blade Fan" },
      { level: 4, name: "Poison Knife" },
      { level: 8, name: "Smoke Bomb" },
      { level: 12, name: "Ambush" },
      { level: 16, name: "Eviscerate" },
    ],
  },
];

/* ---- version + download link stamping ---- */

document.querySelectorAll("[data-version]").forEach((el) => {
  el.textContent = SITE.version;
});

document.querySelectorAll("[data-download-link]").forEach((el) => {
  el.setAttribute("href", SITE.downloadUrl);
});

/* ---- mobile nav ---- */

const navToggle = document.querySelector(".nav-toggle");
const siteNav = document.querySelector(".site-nav");

if (navToggle && siteNav) {
  navToggle.addEventListener("click", () => {
    const open = siteNav.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(open));
  });

  siteNav.addEventListener("click", (event) => {
    if (event.target.closest("a")) {
      siteNav.classList.remove("is-open");
      navToggle.setAttribute("aria-expanded", "false");
    }
  });
}

/* ---- scroll reveal ---- */

const revealTargets = document.querySelectorAll(".reveal");

if (revealTargets.length && "IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 },
  );
  revealTargets.forEach((el) => observer.observe(el));
} else {
  revealTargets.forEach((el) => el.classList.add("is-visible"));
}

/* ---- class explorer (home page only) ---- */

const classTabs = document.querySelector("#class-tabs");
const classDetail = document.querySelector("#class-detail");

function renderClassDetail(entry) {
  classDetail.style.setProperty("--accent", entry.accent);
  classDetail.innerHTML = `
    <div class="class-portrait">
      <div class="walker pixel" style="background-image: url('${entry.sprite}')" role="img" aria-label="${entry.name} sprite"></div>
      <span class="class-name">${entry.name}</span>
      <span class="class-resource">Resource: ${entry.resource}</span>
    </div>
    <div class="class-info">
      <p>${entry.blurb}</p>
      <div class="spec-row" aria-label="Talent specializations, unlocked at level 10">
        ${entry.specs
          .map(
            (spec) =>
              `<span class="spec-chip" style="--accent:${entry.accent}">${spec.name} <small>${spec.role}</small></span>`,
          )
          .join("")}
        <span class="pill">Talents at level 10</span>
      </div>
      <ul class="ability-list">
        ${entry.abilities
          .map(
            (ability) => `
          <li>
            <span class="lvl">Lv ${ability.level}</span>
            ${ability.name}
            <span class="spark" style="background:${entry.accent}; margin-left:auto;"></span>
          </li>`,
          )
          .join("")}
      </ul>
    </div>
  `;
}

if (classTabs && classDetail) {
  classTabs.innerHTML = CLASSES.map(
    (entry, index) => `
    <button class="class-tab${index === 0 ? " is-active" : ""}" type="button"
      data-class="${entry.id}" style="--accent:${entry.accent}"
      role="tab" aria-selected="${index === 0}">
      <span class="dot" aria-hidden="true"></span>
      <span>
        ${entry.name}
        <small>${entry.specs.map((spec) => spec.role).filter((role, i, all) => all.indexOf(role) === i).join(" / ")}</small>
      </span>
    </button>`,
  ).join("");

  renderClassDetail(CLASSES[0]);

  classTabs.addEventListener("click", (event) => {
    const tab = event.target.closest(".class-tab");
    if (!tab) return;
    const entry = CLASSES.find((item) => item.id === tab.dataset.class);
    if (!entry) return;
    classTabs.querySelectorAll(".class-tab").forEach((button) => {
      const active = button === tab;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    });
    renderClassDetail(entry);
  });
}
