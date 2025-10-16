//───────────────────────────────────────────────────────────────
// ✨ openSUSE Sparkle Utility
//───────────────────────────────────────────────────────────────

export function createSparkles() {
  // 🧹 Remove any previous sparkle layers
  document.querySelectorAll(".sparkle-container").forEach(el => el.remove());

  const sparkleContainer = document.createElement("div");
  sparkleContainer.classList.add("sparkle-container");
  document.body.appendChild(sparkleContainer);

  
  const sparkleCount = 300; //220; // sparkkle density control

  for (let i = 0; i < sparkleCount; i++) {
    const sparkle = document.createElement("div");
    sparkle.classList.add("sparkle");

    // subtle variation in transparency
    // sparkle.style.opacity = (Math.random() * 0.15 + 0.05).toFixed(2);
    const size = 1.5 + Math.random() * 4.5;               // larger squares
    sparkle.style.opacity = (Math.random() * 0.25 + 0.10).toFixed(2); // more visible


    // random position and size
    sparkle.style.left = Math.random() * 100 + "vw";
    sparkle.style.top = Math.random() * 100 + "vh";
    sparkle.style.width = sparkle.style.height = `${size}px`;
    

    // random animation duration and delay
    const duration = (3 + Math.random() * 5).toFixed(1);
    const delay = (-Math.random() * duration).toFixed(1);
    sparkle.style.animationDuration = `${duration}s`;
    sparkle.style.animationDelay = `${delay}s`;

    sparkleContainer.appendChild(sparkle);
  }
}
