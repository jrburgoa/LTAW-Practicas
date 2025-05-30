const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8001;
const DIRECTORY = __dirname; // Directorio donde están los archivos

// Función para obtener el tipo de contenido según la extensión del archivo
const getContentType = (ext) => {
    const mimeTypes = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
    };
    return mimeTypes[ext] || 'application/octet-stream';
};

const server = http.createServer((req, res) => {
    const filePath = path.join(DIRECTORY, req.url === '/' ? 'front-end.html' : req.url);
    const ext = path.extname(filePath);

    console.log(`Solicitud recibida: ${req.url}`); // Mostrar en terminal la solicitud

    fs.readFile(filePath, (err, data) => {
        if (err) {
            console.error(`Error al leer el archivo: ${filePath}`);
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end('<h1>404 - Recurso no encontrado</h1>');
        } else {
            res.writeHead(200, { 'Content-Type': getContentType(ext) });
            res.end(data);
        }
    });
});

server.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
});