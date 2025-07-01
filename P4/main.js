// main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');
const colors = require('colors');
const ip = require('ip');
const qrcode = require('qrcode');
const socketServer = require('socket.io').Server;

const PUERTO = 8080;
const CHAT_HTML = fs.readFileSync(path.join(__dirname, 'P3/userChat.html'), 'utf-8');

let clients = [];
let win = null;

// --- SERVIDOR EXPRESS Y SOCKET.IO ---
const serverApp = express();
serverApp.use('/', express.static(__dirname));
serverApp.use(express.static('publico'));

serverApp.post('/login', (req, res) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
        const datos = new URLSearchParams(data);
        const userName = datos.get('userName');
        const names = clients.map(c => c.name);
        if (!userName) return res.status(404).send("Necesitas un nombre de usuario");
        if (names.includes(userName)) return res.status(404).send("Nombre de usuario ya en uso");
        if (userName.toLowerCase() === 'server') return res.status(404).send("Nombre de usuario no disponible");
        res.send(CHAT_HTML);
    });
});

const httpServer = http.createServer(serverApp);
const io = new socketServer(httpServer);

io.on('connect', (socket) => {
    socket.on('connect_login', (name) => {
        console.log('Nueva conexión: '.green + socket.id.blue + ": " + name.yellow);
        clients.push({ name, id: socket.id });
        socket.broadcast.emit("message", JSON.stringify(["general", "server", `Se ha conectado: ${name}`]));
        io.emit("chatList", JSON.stringify(clients));
        socket.emit("message", JSON.stringify(["general", "server", saludoHora() + name + ", bienvenido."]));
        if (win) {
            win.webContents.send('usersCon', clients);
            win.webContents.send('genChat', ["general", "server", `Se ha conectado: ${name}`]);
        }
    });

    socket.on('disconnect', () => {
        console.log('CONEXIÓN TERMINADA CON: '.red + socket.id.yellow);
        let nombre = '';
        clients = clients.filter(c => {
            if (c.id === socket.id) {
                nombre = c.name;
                io.emit("message", JSON.stringify(["general", "server", `Se ha desconectado  ${nombre}`, "disconect", socket.id]));
                if (win) win.webContents.send('genChat', ["general", "server", `Se ha desconectado: ${nombre}`]);
                return false;
            }
            return true;
        });
        io.emit("chatList", JSON.stringify(clients));
        if (win) win.webContents.send('usersCon', clients);
    });

    socket.on('message', (msg) => {
        showMesageData(msg, socket.id);
        if (msg[2]?.[0] === "/") {
            spetialCommands(msg[2], socket, msg[1], msg[0]);
        } else {
            if (msg[0] === "general") {
                socket.broadcast.emit("message", JSON.stringify(msg));
                if (win) win.webContents.send('genChat', msg);
            } else {
                const destinatary = msg[0];
                msg[0] = socket.id;
                io.to(destinatary).emit('message', JSON.stringify(msg));
            }
        }
    });
});

httpServer.listen(PUERTO, () =>
    console.log("Escuchando en puerto: ".yellow + String(PUERTO).blue)
);

// --- FUNCIONES DE SERVIDOR ---

function spetialCommands(command, socket, name, channel) {
    switch (command) {
        case "/help":
            socket.emit("message", JSON.stringify([channel, "server",
                "Comandos Disponibles: <br> - /list: Ver usuarios conectados" +
                "<br> - /hello: Devuelve el saludo<br> - /date: Da la fecha actual"
            ]));
            break;
        case "/list":
            const otros = clients.filter(c => c.id !== socket.id);
            const lista = otros.length > 0
                ? otros.map(c => "- " + c.name).join("<br>")
                : "No hay nadie más conectado.";
            socket.emit("message", JSON.stringify([channel, "server", "Usuarios conectados:<br>" + lista]));
            break;
        case "/hello":
            socket.emit("message", JSON.stringify([channel, "server", "Hola " + name + " !"]));
            break;
        case "/date":
            socket.emit("message", JSON.stringify([channel, "server", getDate()]));
            break;
        default:
            socket.emit("message", JSON.stringify([channel, "server", "Comando no reconocido. Usa /help para ver las opciones."]));
    }
}

function getDate() {
    const f = new Date();
    return `Es el día: ${f.getDate().toString().padStart(2, '0')}/${(f.getMonth() + 1).toString().padStart(2, '0')}/${f.getFullYear()} , a las ${f.getHours().toString().padStart(2, '0')}:${f.getMinutes().toString().padStart(2, '0')} y ${f.getSeconds().toString().padStart(2, '0')} segundos`;
}

function showMesageData(msg, id) {
    console.log("________________________________________________".white);
    console.log("Mensaje recibido: ".magenta);
    console.log("origin id: ".blue + id.yellow);
    console.log("Destination id: ".blue + msg[0].yellow);
    console.log("Message content: ".blue + (msg[0] === "general" ? msg[2].yellow : "PRIVATE CONVERSATION"));
    console.log("________________________________________________".white);
}

function saludoHora() {
    const h = new Date().getHours();
    if (h > 6 && h <= 13) return "Buenos días. ";
    if (h > 13 && h <= 21) return "Buenas tardes. ";
    return "Buenas noches. ";
}

// --- ELECTRON WINDOW (GUI) ---
app.whenReady().then(() => {
    win = new BrowserWindow({
        width: 1200,
        height: 750,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    win.loadFile("GUI/renderer.html");
    win.setMenuBarVisibility(false);

    win.once('ready-to-show', () => {
        const url = "http://" + ip.address() + ":" + PUERTO;
        const qrPath = "./GUI/QR.png";

        qrcode.toFile(qrPath, url, {
            color: { dark: '#000000', light: '#0000' }
        }, (err) => {
            if (!err) {
                console.log('--> New QR made <--'.yellow);
                win.webContents.send('QR', "OK");
            }
        });

        win.webContents.send('systemInfo', {
            node: process.versions.node,
            chrome: process.versions.chrome,
            electron: process.versions.electron,
            ip: ip.address(),
            port: PUERTO
        });

        win.webContents.send('conectionInformation', JSON.stringify([ip.address(), PUERTO, "QR.png"]));
        win.webContents.send('usersCon', clients);
    });

    ipcMain.handle('serverMess', (_, msg) => {
        io.emit("message", JSON.stringify(["general", "server", msg]));
    });
});
