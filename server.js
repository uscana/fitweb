const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

// System files/folders to ignore
const IGNORED_ITEMS = [
    '.git', 
    'node_modules', 
    '.render', 
    'server.js', 
    'index.html', 
    'legal.html',
    'package.json', 
    'package-lock.json'
];

// Helper to read <meta> and <title> from index.html inside subfolders
function getPageMetaData(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        
        const titleMatch = content.match(/<title[^>]*>(.*?)<\/title>/i);
        const title = titleMatch ? titleMatch[1].trim() : null;

        const getMeta = (name) => {
            const match = content.match(new RegExp(`<meta\\s+name=["']${name}["']\\s+content=["'](.*?)["']`, 'i'));
            return match ? match[1].trim() : null;
        };

        const category = getMeta('category');
        const featuredImage = getMeta('featured-image') || getMeta('image');
        const icon = getMeta('icon') || featuredImage;
        const price = getMeta('price') || 'Purchase Now';
        const ctaLink = getMeta('cta-link');
        
        let description = getMeta('description') || '';
        if (description.length > 160) {
            description = description.substring(0, 157) + '...';
        }

        return { title, category, featuredImage, icon, price, ctaLink, description };
    } catch (err) {
        console.error(`Error parsing metadata from ${filePath}:`, err.message);
        return null;
    }
}

const server = http.createServer((req, res) => {
    const currentDir = __dirname;

    // [PERBAIKAN] -------------------------------------------------------------
    // Mengambil URL yang diketik pengunjung, lalu membuang kode UTM/Parameter
    // Contoh: "/halaman?pp=1" hanya akan diambil "/halaman"-nya saja.
    const host = req.headers.host || 'localhost';
    const baseURL = `http://${host}`;
    const parsedUrl = new URL(req.url, baseURL);
    const cleanPath = parsedUrl.pathname; 
    // -------------------------------------------------------------------------

    // 1. API Endpoint
    // [PERBAIKAN] Mengubah req.url menjadi cleanPath
    if (cleanPath === '/api/posts') {
        fs.readdir(currentDir, { withFileTypes: true }, (err, files) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Failed to read directory' }));
            }

            const discoveredPosts = [];

            files.forEach(file => {
                if (file.isDirectory() && !IGNORED_ITEMS.includes(file.name)) {
                    const folderName = file.name;
                    const indexPath = path.join(currentDir, folderName, 'index.html');

                    if (fs.existsSync(indexPath)) {
                        const meta = getPageMetaData(indexPath) || {};
                        const category = meta.category || '';

                        if (category) {
                            discoveredPosts.push({
                                title: meta.title || folderName,
                                category: category,
                                folder: folderName,
                                price: meta.price,
                                description: meta.description,
                                ctaLink: meta.ctaLink || `./${folderName}/`,
                                featuredImg: meta.featuredImage ? `./${folderName}/${meta.featuredImage}` : '',
                                iconImg: meta.icon ? `./${folderName}/${meta.icon}` : ''
                            });
                        }
                    }
                }
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(discoveredPosts));
        });
    }

    // 2. Main Route (index.html root)
    // [PERBAIKAN] Mengubah req.url menjadi cleanPath
    else if (cleanPath === '/' || cleanPath === '/index.html') {
        fs.readFile(path.join(currentDir, 'index.html'), (err, content) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
                return res.end('File index.html not found.');
            }
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(content);
        });
    }

    // 3. Static Asset Router (Clean URL Support)
    else {
        // [PERBAIKAN] Mengubah req.url menjadi cleanPath
        let reqPath = decodeURIComponent(cleanPath).replace(/^\.\//, '');
        if (reqPath.startsWith('/')) reqPath = reqPath.substring(1);

        let filePath = path.join(currentDir, reqPath);

        if (!filePath.startsWith(currentDir)) {
            res.writeHead(403, { 'Content-Type': 'text/plain' });
            return res.end('Access Denied');
        }

        if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
            filePath = path.join(filePath, 'index.html');
        }

        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const ext = path.extname(filePath).toLowerCase();
            const mimeTypes = {
                '.html': 'text/html; charset=utf-8',
                '.css': 'text/css',
                '.js': 'text/javascript',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.gif': 'image/gif',
                '.svg': 'image/svg+xml',
                '.webp': 'image/webp'
            };

            res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
            fs.createReadStream(filePath).pipe(res);
        } else {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('404 File Not Found');
        }
    }
});

server.listen(PORT, () => {
    console.log(`Server fitweb.eu.org running on port ${PORT}`);
});
