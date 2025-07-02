// renderer.js
const { ipcRenderer } = require('electron');

// Helper para formatear la fecha/hora
function getDate() {
  const f = new Date();
  const two = n => n.toString().padStart(2, '0');
  return `${two(f.getDate())}/${two(f.getMonth()+1)}/${f.getFullYear()} ` +
         `${two(f.getHours())}:${two(f.getMinutes())}:${two(f.getSeconds())}`;
}

// 1) Mostrar info de sistema (versiones y URL)
ipcRenderer.on('systemInfo', (_, info) => {
  document.getElementById('nodeText').textContent     = info.node;
  document.getElementById('chromeText').textContent   = info.chrome;
  document.getElementById('electronText').textContent = info.electron;
  document.getElementById('replaceURL').textContent   = `${info.ip}:${info.port}`;
});

// 2) Actualizar lista y contador de usuarios conectados
ipcRenderer.on('usersCon', (_, clients) => {
  const countEl = document.getElementById('usersConNum');
  const listEl  = document.getElementById('usersConList');

  // Número total de usuarios
  countEl.textContent = clients.length;

  // Lista de usuarios
  listEl.innerHTML = '';
  clients.forEach(c => {
    const div = document.createElement('div');
    div.classList.add('conectedDiv');
    div.innerHTML = `
      <span class="greenDot"> • </span>
      <span class="notGreenDot">${c.name}</span>
    `;
    listEl.appendChild(div);
  });
});

// 3) Mostrar mensajes en chat general
ipcRenderer.on('genChat', (_, msg) => {
  const container = document.getElementById('smallChatDivDiv');
  const typeText  = msg[1] === 'server' ? 2 : 1;
  const bubble    = document.createElement('div');
  bubble.classList.add(`messageClassDiv${typeText}`);
  bubble.innerHTML = `
    <p class="chatTimeText">
      <span class="userName">${msg[1]}</span>
      <span class="messDate">${getDate()}</span>
    </p>
    <p class="chatText">${msg[2]}</p>
  `;
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
});



// 4) Cargar código QR cuando esté listo
ipcRenderer.on('QR', (_, qrPath) => {
  document.getElementById('QR').src = qrPath;
});

// 5) Botones para enviar mensajes del servidor
document.getElementById('sendButton').addEventListener('click', () => {
  const txt = document.getElementById('inputTextServer').value.trim();
  if (!txt) return;
  ipcRenderer.invoke('serverMess', txt);
  document.getElementById('inputTextServer').value = '';
});

document.getElementById('testButton').addEventListener('click', () => {
  ipcRenderer.invoke('serverMess', 'Mensaje de prueba desde GUI');
});
