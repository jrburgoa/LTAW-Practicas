const socket       = io();
const button       = document.getElementById("inputButton");
const messagesDiv  = document.getElementById("messagesDiv");
const input        = document.getElementById("inputInput");
const usersListDiv = document.getElementById("usersListDiv");

let CHAT_DATABASE = { general: "<div class='invisibleDiv'></div>" };
let STATE         = "general";
let USERS_LIST    = [];
let AUDIO = new Audio('/WebShoot.mp3')
function getDate() {
  const d = new Date();
  return String(d.getHours()).padStart(2,'0')
       + ":" + String(d.getMinutes()).padStart(2,'0');
}

function setState(id) {
  STATE = id;
  messagesDiv.innerHTML = CHAT_DATABASE[id];
  messagesDiv.scrollTop   = messagesDiv.scrollHeight;

  // reset fila activa
  Array.from(document.getElementsByClassName("userChat"))
       .forEach(el => el.style.backgroundColor = "#464646");

  const active = document.getElementById(id);
  active.style.backgroundColor = "#666666";
  active.querySelector("#unread").textContent = "";

  // título
  const titleEl = document.getElementById("tittleConversationH1");
  if (id === "general") {
    titleEl.textContent = "General";
  } else {
    const u = USERS_LIST.find(x => x.id === id);
    titleEl.textContent = u ? u.name : "";
  }
}

function sendMessage() {
  const msg = input.value.trim();
  if (!msg) return;
  input.value = "";

  // plantilla mensaje propio
  CHAT_DATABASE[STATE] += `
    <div class="message message--me">
      <p class="message__meta">
        <span class="message__author">Tú</span>
        <span class="message__time">${getDate()}</span>
      </p>
      <p class="message__text">${msg}</p>
    </div>`;
  
  // emito al servidor
  socket.emit("message", [ STATE, USERNAME, msg ]);
  // muestro
  setState(STATE);
}

button.onclick = sendMessage;
document.addEventListener("keydown", e => {
  if (e.key === "Enter") sendMessage();
});

socket.on("connect", () => {
  socket.emit("connect_login", USERNAME);
});

socket.on("message", raw => {
  const msg = JSON.parse(raw);

  if (msg[1] === "server") {
    // plantilla mensaje server
    CHAT_DATABASE[msg[0]] += `
      <div class="message message--server">
        <p class="message__text">${msg[2]}</p>
        <span class="message__time">${getDate()}</span>
      </div>`;
  } else {
    // mensaje ajeno
    AUDIO.play()
    CHAT_DATABASE[msg[0]] += `
      <div class="message">
        <p class="message__meta">
          <span class="message__author">${msg[1]}</span>
          <span class="message__time">${getDate()}</span>
        </p>
        <p class="message__text">${msg[2]}</p>
      </div>`;
  }

  if (STATE === msg[0]) {
    setState(msg[0]);
  } else {
    // marca no leído
    const div = document.getElementById(msg[0]);
    const badge = div.querySelector("#unread");
    const n = parseInt(badge.textContent.replace(/\D/g,'')) || 0;
    badge.textContent = ` (${n+1})`;
  }
});

socket.on("chatList", raw => {
  USERS_LIST = JSON.parse(raw);
  usersListDiv.innerHTML = `
    <div class="userChat" id="general" onclick="setState('general')">
      <p class="userNameUserChat">General</p>
      <p id="unread"></p>
    </div>`;
  USERS_LIST.forEach(u => {
    if (u.name !== USERNAME) {
      if (!CHAT_DATABASE[u.id]) CHAT_DATABASE[u.id] = "<div class='invisibleDiv'></div>";
      usersListDiv.innerHTML += `
        <div class="userChat" id="${u.id}" onclick="setState('${u.id}')">
          <p class="userNameUserChat">${u.name}</p>
          <p id="unread"></p>
        </div>`;
    }
  });
  // resalta la pestaña activa tras recargar lista
  setState(STATE);
});
