const { ipcRenderer } = require('electron');

// 1) Mostrar info del sistema
ipcRenderer.on('systemInfo', (_, info) => {
  document.getElementById('info').textContent = `
IP: ${info.ip}
Puerto: ${info.port}
Node: ${info.node}
Chrome: ${info.chrome}
Electron: ${info.electron}
  `;
});

// 2) Lista de usuarios conectados
ipcRenderer.on('usersCon', (_, clients) => {
  const ul = document.getElementById('usersList');
  ul.innerHTML = '';
  clients.forEach(c => {
    const li = document.createElement('li');
    li.textContent = c.name;
    ul.appendChild(li);
  });
});

// 3) Mensajes del chat general
ipcRenderer.on('genChat', (_, msg) => {
  const div = document.getElementById('messages');
  const p = document.createElement('p');
  p.innerHTML = `<strong>${msg[1]}:</strong> ${msg[2]}`;
  div.appendChild(p);
  div.scrollTop = div.scrollHeight;
});

// 4) Botón de envío de test
document.getElementById('btnTest').addEventListener('click', () => {
  const text = document.getElementById('txtTest').value.trim();
  if (!text) return;
  ipcRenderer.invoke('serverMess', text);
  document.getElementById('txtTest').value = '';
});
