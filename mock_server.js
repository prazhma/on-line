const http = require('http'), fs = require('fs'), path = require('path');
const cfg = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const branches = cfg.branches || cfg;
http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const send = (code, obj) => { res.writeHead(code, {'Content-Type':'application/json'}); res.end(JSON.stringify(obj)); };
    if (u.pathname === '/get_branches.php') return send(200, { status:'success', branches, config: cfg });
    if (u.pathname === '/getslots_b2b.php') {
        const slots = [];
        for (let h = 9; h < 19; h++) slots.push({ time: String(h).padStart(2,'0')+':00', available: h % 3 !== 0 });
        return send(200, { status:'success', slots });
    }
    if (u.pathname === '/api/customer.php') {
        let b=''; req.on('data',d=>b+=d); req.on('end',()=>{
            try { JSON.parse(b||'{}'); } catch(e){}
            return send(200, { status:'success', client: { id: 457, name: 'Иван Петров', phone: 'x', email: '' } });
        });
        return;
    }
    if (u.pathname === '/api/cars.php') return send(200, { status:'success', cars: [ { title:'Kia Rio', plate:'А123ВС' }, { title:'Toyota RAV4', plate:'О777ХХ' } ] });
    if (u.pathname === '/booking_handler.php') {
        let b=''; req.on('data',d=>b+=d); req.on('end',()=>{ console.log('BOOKING RECEIVED:', b.slice(0,300)); return send(200, { status:'success' }); });
        return;
    }
    const fp = path.join(__dirname, u.pathname === '/' ? 'index.html' : u.pathname);
    fs.readFile(fp, (e, d) => { if (e) { res.writeHead(404); return res.end('nf'); } 
        const ext = path.extname(fp);
        res.writeHead(200, {'Content-Type': ext==='.html'?'text/html':ext==='.js'?'application/javascript':ext==='.css'?'text/css':'application/json'});
        res.end(d); });
}).listen(8099, () => console.log('mock up on 8099'));
