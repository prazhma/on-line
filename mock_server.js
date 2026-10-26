const http = require('http'), fs = require('fs'), path = require('path');
const cfg = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const branches = cfg.branches || cfg;
http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const send = (code, obj) => { res.writeHead(code, {'Content-Type':'application/json'}); res.end(JSON.stringify(obj)); }
    if (u.pathname === '/get_branches.php') return send(200, { status:'success', branches, config: cfg })
    if (u.pathname === '/getslots_b2b.php') {
        const slots = [];
        for (let h = 9; h < 19; h++) slots.push({ time: String(h).padStart(2,'0')+':00', available: h % 3 !== 0 });
        return send(200, { status:'success', slots });
    }
    if (u.pathname === '/api/customer.php') {
        let b=''; req.on('data',d=>b+=d); req.on('end',()=>{
            let phone = '';
            try { phone = (JSON.parse(b||'{}').phone||'').replace(/\D/g,''); } catch(e){}
            // «найдены» только номера, начинающиеся с +7 999 000
            if (phone.startsWith('7999000')) {
                return send(200, { status:'success', client: { id: 457, name: 'Петров Иван Сергеевич', phone, email: '' } });
            }
            return send(200, { status: 'error', message: 'Клиент не найден' });
        });
        return;
    }
    if (u.pathname === '/api/cars.php') return send(200, { status:'success', cars: [
        { id: 11, title: 'Kia Rio', brand: 'Kia', model: 'Rio', plate: 'А123ВС 93', vin: '—' },
        { id: 12, title: 'Toyota RAV4', brand: 'Toyota', model: 'RAV4', plate: 'О777ХХ 77', vin: '—' }
    ] });
    if (u.pathname === '/booking_handler.php') {
        let b=''; req.on('data',d=>b+=d); req.on('end',()=>{ console.log('BOOKING RECEIVED:', b.slice(0,600)); return send(200, { status:'success' }); });
        return;
    }
    const fp = path.join(__dirname, u.pathname === '/' ? 'index.html' : u.pathname);
    fs.readFile(fp, (e, d) => { if (e) { res.writeHead(404); return res.end('nf'); }
        const ext = path.extname(fp);
        res.writeHead(200, {'Content-Type': ext==='.html'?'text/html; charset=utf-8':ext==='.js'?'application/javascript':ext==='.css'?'text/css':'application/json; charset=utf-8'});
        res.end(d); });
}).listen(8099, () => console.log('mock up on 8099'));
