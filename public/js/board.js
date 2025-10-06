async function loadBoard() {
  const res = await fetch('/api/recognitions/recent');
  if (!res.ok) return;
  const data = await res.json();
  const container = document.getElementById('board-rows');
  container.innerHTML = '';
  for (const r of data) {
    const toNames = r.recipients.map(rr => rr.user.username).join(', ');
    const row = document.createElement('a');
    row.href = `/recognition/${r.slug}`;
    row.className = 'row link-row flip';
    row.innerHTML = `
      <div class="cell cell-icon">🏆</div>
      <div class="cell cell-user">
        ${r.fromUser?.avatarUrl ? `<img class="avatar" src="${r.fromUser.avatarUrl}" alt="${r.fromUser.username}"/>` : ''}
        <span>${r.fromUser?.username || ''}</span>
      </div>
      <div class="cell cell-user">
        ${r.recipients[0]?.user?.avatarUrl ? `<img class="avatar" src="${r.recipients[0].user.avatarUrl}" alt="${r.recipients[0].user.username}"/>` : ''}
        <span>${toNames}</span>
      </div>
      <div class="cell">${new Date(r.createdAt).toLocaleString()}</div>
      <div class="cell">${(r.message || r.title || '').slice(0, 72)}</div>
    `;
    container.appendChild(row);
  }
}
loadBoard();
setInterval(loadBoard, 30000);
