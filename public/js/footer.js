async function cycleAchievements() {
  const res = await fetch('/api/achievements/recent');
  if (!res.ok) return;
  const items = await res.json();
  if (!items.length) return;
  const el = document.getElementById('achievement-footer');
  let i = 0;
  const show = () => {
    const a = items[i];
    el.style.opacity = 0;
    setTimeout(() => {
      el.style.color = 'var(--geeko-green)';
      el.innerHTML = `💫 <b><a href="/recognition/${a.recognitionSlug}">${a.user}</a></b> just received the <b>${a.achievement.title}</b> badge!`;
      el.style.opacity = 1;
    }, 200);
    i = (i + 1) % items.length;
  };
  show();
  setInterval(show, 16000);
}
cycleAchievements();
