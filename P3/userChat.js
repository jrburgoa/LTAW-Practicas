// userChat.js

const socket         = io();
const button         = document.getElementById("inputButton");
const messagesDiv    = document.getElementById("messagesDiv");
const input          = document.getElementById("inputInput");
const usersListDiv   = document.getElementById("usersListDiv");
const USERNAME = document.body.dataset.username;

let CHAT_DATABASE = { general: "" };
let STATE         = "general";
let USERS_LIST    = [];

/**
 * Devuelve la hora en formato HH:MM
 */
function getDate() {
  const d      = new Date();
  const hour   = d.getHours().toString().padStart(2, '0');
  const minute = d.getMinutes().toString().padStart(2, '0');
  return `${hour}:${minute}`;
}

/**
 * Cambia de chat activo y refresca los mensajes
 */
function setState(id) {
  STATE = id;
  messagesDiv.innerHTML = CHAT_DATABASE[id] || "";
  messagesDiv.scrollTop = messagesDiv.scrollHeight;

  // Reset background de todas las filas
  document.querySelectorAll(".userChat").forEach(el => {
    el.classList.remove("active");
  });

  // Marca la fila activa
  const activeRow = document.getElementById(id);
  if (activeRow) activeRow.classList.add("active");

  // Cambia título
  if (id === "general") {
    document.getElementById("tittleConversationH1").textContent = "General";
  } else {
    const user = USERS_LIST.find(u => u.id === id);
    document.getElementById("tittleConversationH1").textContent = user ? user.name : "";
  }
}

/**
 * Envía mensaje propio
 */
function sendMessage() {
  const msg   = input.value.trim();
  if (!msg) return;
  input.value = "";

  // Añade al chat local
  const timestamp = getDate();
  const html = `
    <div class="message message--me">
      <p class="message__meta">
        <span class="message__author">Tú</span>
        <span class="message__time">${timestamp}</span>
      </p>
      <p class="message__text">${msg}</p>
    </div>`;
  CHAT_DATABASE[STATE] += html;
  messagesDiv.innerHTML = CHAT_DATABASE[STATE];
  messagesDiv.scrollTop  = messagesDiv.scrollHeight;

  // Emite al servidor
  socket.emit("message", [ STATE, USERNAME, msg ]);
}

// Envía mensaje al pulsar botón o Enter
button.onclick = sendMessage;
document.addEventListener("keydown", ev => {
  if (ev.key === "Enter") sendMessage();
});

// Al conectar con Socket.io
socket.on("connect", () => {
  socket.emit("connect_login", USERNAME);
});

// Recibe mensajes del servidor
socket.on("message", payload => {
  const msg = JSON.parse(payload);
  const ts  = getDate();
  let html;

  if (msg[1] === "server") {
    // Mensaje del servidor
    html = `
      <div class="message message--server">
        <p class="message__author">Server</p>
        <p class="message__text">${msg[2]}</p>
        <span class="message__time">${ts}</span>
      </div>`;
  } else {
    // Mensaje de otro usuario
    html = `
      <div class="message">
        <p class="message__meta">
          <span class="message__author">${msg[1]}</span>
          <span class="message__time">${ts}</span>
        </p>
        <p class="message__text">${msg[2]}</p>
      </div>`;
  }

  // Guarda y muestra o marca como no leído
  CHAT_DATABASE[msg[0]] += html;
  if (STATE === msg[0]) {
    setState(STATE);
  } else {
    const badge = document.querySelector(`#${msg[0]} #unread`);
    const count = parseInt(badge.textContent.replace(/\D/g,'')) || 0;
    badge.textContent = `(${count + 1})`;
  }
});

// Actualiza lista de usuarios
socket.on("chatList", payload => {
  USERS_LIST = JSON.parse(payload);
  usersListDiv.innerHTML = "";

  // Always show general
  usersListDiv.innerHTML += `
    <div class="userChat" id="general" onclick="setState('general')">
      <p class="userNameUserChat">General</p>
      <p id="unread"></p>
    </div>`;

  // Add each user
  USERS_LIST.forEach(u => {
    if (u.name !== USERNAME) {
      if (!CHAT_DATABASE[u.id]) CHAT_DATABASE[u.id] = "";
      usersListDiv.innerHTML += `
        <div class="userChat" id="${u.id}" onclick="setState('${u.id}')">
          <p class="userNameUserChat">${u.name}</p>
          <p id="unread"></p>
        </div>`;
    }
  });

  // Reactiva el estado actual (para remarcar)
  setState(STATE);
});
