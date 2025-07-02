// main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path               = require('path');
const fs                 = require('fs');
const http               = require('http');
const express            = require('express');
const colors             = require('colors');
const ip                 = require('ip');
const qrcode             = require('qrcode');
const { Server: SocketServer } = require('socket.io');

const PUERTO   = 8080;
const CHAT_HTML = fs.readFileSync(
  path.join(__dirname, 'P3', 'userChat.html'),
  'utf-8'
);

let clients = [];
let win     = null;

// EXPRESS + SOCKET.IO

const serverApp = express();
serverApp.use('/',        express.static(__dirname));
serverApp.use('/P3',      express.static(path.join(__dirname, 'P3')));
serverApp.use('/publico', express.static(path.join(__dirname, 'publico')));

serverApp.post('/login', (req, res) => {
  let data = '';
  req.on('data', chunk => data += chunk);
  req.on('end', () => {
    const params     = new URLSearchParams(data);
    const userName   = params.get('userName') || '';
    const namesInUse = clients.map(c => c.name);

    if (!userName)               return res.status(404).send("Necesitas un nombre de usuario");
    if (namesInUse.includes(userName)) return res.status(404).send("Nombre de usuario ya en uso");
    if (userName.toLowerCase()==='server') return res.status(404).send("Nombre de usuario no disponible");

    res.send(CHAT_HTML);
  });
});

const httpServer = http.createServer(serverApp);
const io         = new SocketServer(httpServer);

io.on('connect', socket => {

  //  LOGIN 
  socket.on('connect_login', name => {
    console.log('Nueva conexión: '.green + socket.id.blue + ": " + name.yellow);
    clients.push({ name, id: socket.id });

    // 1) Mensaje broadcast a clientes web
    const msgConnect = ['general','server', `Se ha conectado: ${name}`];
    socket.broadcast.emit('message', JSON.stringify(msgConnect));
    io.emit('chatList', JSON.stringify(clients));

    // 2) Saludo al que entra
    const welcome = ['general','server', saludoPorHora() + name + ', bienvenido.'];
    socket.emit('message', JSON.stringify(welcome));

    // 3) ENVIAR todo esto también al renderer
    if (win) {
      win.webContents.send('usersCon', clients);
      win.webContents.send('genChat', msgConnect);
      win.webContents.send('genChat', welcome);
    }
  });

  //  DISCONNECT 
  socket.on('disconnect', () => {
    console.log('CONEXIÓN TERMINADA CON: '.red + socket.id.yellow);

    let who = '';
    clients = clients.filter(c => {
      if (c.id === socket.id) {
        who = c.name;
        // aviso global
        const msgDisc = ['general','server', `Se ha desconectado: ${who}`];
        io.emit('message', JSON.stringify(msgDisc));
        if (win) win.webContents.send('genChat', msgDisc);
        return false;
      }
      return true;
    });

    io.emit('chatList', JSON.stringify(clients));
    if (win) win.webContents.send('usersCon', clients);
  });

  // MENSAJES
  socket.on('message', msg => {
    mostrarDatosMensaje(msg, socket.id);

    if (msg[2]?.startsWith('/')) {
      manejarComando(msg[2], socket, msg[1], msg[0]);
    } else {
      if (msg[0] === 'general') {
        // 1) broadcast a otros clientes
        socket.broadcast.emit('message', JSON.stringify(msg));
        // 2) y también a nuestra GUI
        if (win) win.webContents.send('genChat', msg);

      } else {
        // 1) conversación privada
        const dest = msg[0];
        msg[0] = socket.id;
        io.to(dest).emit('message', JSON.stringify(msg));
      }
    }
  });

});

httpServer.listen(PUERTO, () => {
  console.log(`Servidor HTTP escuchando en http://localhost:${PUERTO}`.yellow);
  startElectron();
});

// COMANDOS & UTILITIES 

function manejarComando(cmd, socket, name, channel) {
  switch (cmd) {
    case '/help': {
      const text = 'Comandos disponibles:<br>'
                 + '- /list: ver usuarios<br>'
                 + '- /hello: saludo<br>'
                 + '- /date: fecha/hora';
      const payload = [channel, 'server', text];
      socket.emit('message', JSON.stringify(payload));
      if (win) win.webContents.send('genChat', payload);
      break;
    }

    case '/list': {
      const others = clients.filter(c => c.id !== socket.id);
      const listTxt = others.length
        ? others.map(c => `- ${c.name}`).join('<br>')
        : 'No hay nadie más conectado.';
      const payload = [channel,'server', listTxt];
      socket.emit('message', JSON.stringify(payload));
      if (win) win.webContents.send('genChat', payload);
      break;
    }

    case '/hello': {
      const payload = [channel,'server', `Hola ${name}!`];
      socket.emit('message', JSON.stringify(payload));
      if (win) win.webContents.send('genChat', payload);
      break;
    }

    case '/date': {
      const payload = [channel,'server', getDate()];
      socket.emit('message', JSON.stringify(payload));
      if (win) win.webContents.send('genChat', payload);
      break;
    }

    default: {
      const payload = [channel,'server', 'Comando no reconocido. Usa /help'];
      socket.emit('message', JSON.stringify(payload));
      if (win) win.webContents.send('genChat', payload);
    }
  }
}

function saludoPorHora() {
  const h = new Date().getHours();
  if (h > 6 && h <= 13) return 'Buenos días. ';
  if (h > 13 && h <= 21) return 'Buenas tardes. ';
  return 'Buenas noches. ';
}

function getDate() {
  const f = new Date();
  const D = n => n.toString().padStart(2,'0');
  return `${D(f.getDate())}/${D(f.getMonth()+1)}/${f.getFullYear()} `
       + `${D(f.getHours())}:${D(f.getMinutes())}:${D(f.getSeconds())}`;
}

function mostrarDatosMensaje(msg, id) {
  console.log(''.white);
  console.log('Mensaje recibido:'.magenta);
  console.log(' Origen:'.blue, id.yellow);
  console.log(' Destino:'.blue, msg[0].yellow);
  console.log(' Contenido:'.blue,
    msg[0] === 'general'
      ? msg[2].yellow
      : 'PRIVATE CONVERSATION'
  );
  console.log(''.white);
}


// 3) CONFIGURAR ELECTRON (ventana & IPC)


function startElectron() {
  // desactiva la GPU para evitar errores sobre VNC
  app.disableHardwareAcceleration();

  app.whenReady().then(() => {
    win = new BrowserWindow({
      width: 1200,
      height: 750,
      webPreferences: {
        nodeIntegration:    true,
        contextIsolation:   false
      }
    });

    // carga tu GUI mínima que incluye el chat embebido
    // (ver luego <webview> apuntando a http://localhost:8080/P3/userChat.html)
    win.loadFile(path.join(__dirname, 'GUI', 'renderer.html'));
    win.setMenuBarVisibility(false);

    win.once('ready-to-show', () => {
      // 3a) enviar info sistema
      win.webContents.send('systemInfo', {
        node:    process.versions.node,
        chrome:  process.versions.chrome,
        electron:process.versions.electron,
        ip:      ip.address(),
        port:    PUERTO
      });

      // 3b) generar QR
      const url    = `http://${ip.address()}:${PUERTO}`;
      const qrPath = path.join(__dirname, 'GUI', 'QR.png');
      qrcode.toFile(qrPath, url, { color:{dark:'#000',light:'#fff'} }, err => {
        if (!err) {
          console.log('--> QR generado <--'.yellow);
          win.webContents.send('QR', qrPath);
        }
      });

      // 3c) estado inicial de usuarios
      win.webContents.send('usersCon', clients);
    });

    // 5) recibir test desde render y reenviar al chat
    ipcMain.handle('serverMess', (_, msg) => {
      io.emit('message', JSON.stringify(['general','server', msg]));
    });
  });
}