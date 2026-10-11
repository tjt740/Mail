/* Shared, decorative Canvas motion. No user content is read by the renderer. */
(function () {
    'use strict';
    const instances = new Map();
    const palettes = {
        clay: [201, 100, 66], ocean: [37, 99, 235], emerald: [5, 150, 105],
        violet: [124, 58, 237], rose: [225, 29, 72],
        sunny: [38, 120, 206], night: [163, 175, 255], rain: [104, 216, 224]
    };

    // Stable per-drop seeds avoid flicker; every new fall gets a different starting point.
    const rainFields = new WeakMap();
    const stormFields = new WeakMap();
    const sunnyFields = new WeakMap();
    let cloudSprites;
    const fraction = value => value - Math.floor(value);
    const rainNoise = seed => fraction(Math.sin(seed * 127.1 + 311.7) * 43758.5453);
    function stormField(ctx, time = 0) {
        let field = stormFields.get(ctx);
        if (!field) {
            // A fresh storm per canvas/session; keep its geometry stable between frames.
            let seed = Math.floor(Math.random() * 0xffffffff) || 1;
            const random = () => {
                seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
                return seed / 0x100000000;
            };
            field = { random, salt: random() * 1000, next: time + 4 + random() * 4, strike: null };
            stormFields.set(ctx, field);
        }
        return field;
    }
    function windAt(time) {
        return 74 + 68 * Math.sin(time * .53) + 34 * Math.sin(time * 1.37 + 1.1) + 46 * Math.sin(time * .19 + 2.4);
    }
    function windTravel(time) {
        return 74 * time - 68 / .53 * Math.cos(time * .53) - 34 / 1.37 * Math.cos(time * 1.37 + 1.1) - 46 / .19 * Math.cos(time * .19 + 2.4);
    }
    function drawRain(ctx, width, height, time, { hero, coarse, foreground }) {
        const salt = stormField(ctx, time).salt;
        const noise = seed => rainNoise(seed + salt);
        const count = Math.min(coarse ? 64 : 170, Math.max(coarse ? 32 : 64, Math.round(width * height / (hero ? 2300 : foreground ? 10000 : 8500))));
        let drops = rainFields.get(ctx);
        if (!drops || drops.length !== count) {
            drops = Array.from({ length: count }, (_, i) => {
                const depth = .28 + noise(i + 3) * .72;
                return { seed: i + 1, depth, phase: noise(i + 71), speed: 180 + depth * 370 + noise(i + 29) * 140,
                    length: 9 + depth * 23 + noise(i + 47) * 11, alpha: .07 + depth * .2, width: .45 + depth * .9 };
            });
            rainFields.set(ctx, drops);
        }
        const wind = windAt(time);
        // Low, wind-driven banks of mist, stretched horizontally rather than a full-screen blur.
        const mistCount = coarse ? 2 : 3;
        for (let i = 0; i < mistCount; i++) {
            const x = width * (.18 + i * .36) + Math.sin(time * .17 + i * 2.3) * width * .2;
            const y = height * (.2 + i * .28) + Math.sin(time * .23 + i) * height * .06;
            const radius = Math.max(90, Math.min(width * .48, 520));
            ctx.save(); ctx.translate(x, y); ctx.scale(1, hero ? .28 : .4);
            const mist = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
            const opacity = (hero ? .11 : foreground ? .025 : .055) * (.75 + Math.sin(time * .31 + i) * .25);
            mist.addColorStop(0, `rgba(130,181,201,${opacity})`);
            mist.addColorStop(1, 'rgba(130,181,201,0)');
            ctx.fillStyle = mist; ctx.fillRect(-radius, -radius, radius * 2, radius * 2); ctx.restore();
        }
        ctx.lineCap = 'round';
        drops.forEach(drop => {
            const period = (height + 100) / drop.speed;
            const clock = time / period + drop.phase;
            const cycle = Math.floor(clock);
            const age = fraction(clock) * period;
            const y = -50 + fraction(clock) * (height + 100);
            const drift = (windTravel(time) - windTravel(time - age)) * drop.depth;
            const span = width + 240;
            const x = fraction(noise(drop.seed + cycle * 19.73) + drift / span) * span - 120;
            const turbulence = Math.sin(time * 2.7 + drop.seed * 1.9) * 13;
            const slant = (wind * drop.depth + turbulence) / drop.speed;
            const length = drop.length * (1 + Math.abs(wind) / 850);
            // Slowly moving showers create dense patches and gaps, without blinking drops.
            const shower = .63 + .37 * Math.sin(x / Math.max(width, 1) * 5.7 - time * .72 + drop.phase);
            // Near rain belongs mostly to the glass edges, keeping text unobscured.
            const edge = foreground ? .13 + .87 * Math.pow(Math.min(1, Math.abs(x / width - .5) * 2), 3) : 1;
            ctx.strokeStyle = `rgba(169,215,237,${drop.alpha * shower * edge * (hero ? 1.3 : 1)})`;
            ctx.lineWidth = drop.width;
            ctx.beginPath(); ctx.moveTo(x - slant * length, y - length); ctx.lineTo(x, y); ctx.stroke();
        });
        // Staggered impacts in a shallow ground plane. Positions change between rain cycles.
        const impacts = coarse ? 5 : hero ? 14 : 18;
        for (let i = 0; i < impacts; i++) {
            const clock = time * (.42 + noise(i + 301) * .55) + noise(i + 401);
            const cycle = Math.floor(clock), age = fraction(clock);
            if (age > .68) continue;
            const progress = age / .68;
            const x = noise(i + cycle * 31.7 + 501) * width;
            const y = height * (.77 + noise(i + cycle * 13.1 + 601) * .2);
            const radius = 2 + progress * (10 + noise(i + 701) * 15);
            ctx.lineWidth = .6;
            ctx.strokeStyle = `rgba(157,215,226,${Math.sin(progress * Math.PI) * (hero ? .23 : foreground ? .09 : .14)})`;
            ctx.beginPath(); ctx.ellipse(x, y, radius, radius * .22, 0, 0, Math.PI * 2); ctx.stroke();
            if (progress < .3) {
                const splash = Math.sin(progress / .3 * Math.PI) * 5;
                ctx.beginPath(); ctx.moveTo(x - 3, y - splash); ctx.lineTo(x, y); ctx.lineTo(x + 3 + wind * .015, y - splash * .75); ctx.stroke();
            }
        }
    }

    function drawStorm(ctx, width, height, time, { coarse, foreground, lightning, motion }) {
        const field = stormField(ctx, time);
        // Broad cloud shadows roll slowly across the upper sky.
        for (let i = 0; i < (coarse ? 2 : 4); i++) {
            const radius = Math.max(160, width * .46);
            const x = width * (i * .34) + Math.sin(time * .035 + i * 2.1 + field.salt) * width * .18;
            ctx.save(); ctx.translate(x, height * (.015 + i % 2 * .09)); ctx.scale(1, .32);
            const cloud = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
            cloud.addColorStop(0, `rgba(4,9,22,${foreground ? .10 : .28})`);
            cloud.addColorStop(.65, `rgba(15,28,49,${foreground ? .04 : .10})`);
            cloud.addColorStop(1, 'rgba(15,28,49,0)');
            ctx.fillStyle = cloud; ctx.fillRect(-radius, -radius, radius * 2, radius * 2); ctx.restore();
        }
        if (!lightning || !motion) return;
        if (time >= field.next) {
            const { random } = field;
            const left = random() < .5;
            let x = left ? .02 + random() * .16 : .82 + random() * .16, y = -.025;
            const points = [[x, y]];
            const reach = .18 + random() * .27;
            for (let i = 1; i <= 12; i++) {
                x += (random() - .5) * .052 + (left ? .003 : -.003);
                y = reach * i / 12;
                points.push([x, y]);
            }
            const branches = [4, 7].map(index => {
                const start = points[index], side = random() < .5 ? -1 : 1;
                return [start, [start[0] + side * (.02 + random() * .02), start[1] + .025],
                    [start[0] + side * (.045 + random() * .025), start[1] + .075]];
            });
            // Long, irregular quiet intervals, with an occasional softer afterglow.
            field.strike = { start: time, points, branches, x: points[0][0], echo: random() > .4, strength: .65 + random() * .35 };
            field.next = time + 8 + random() * 16;
        }
        const strike = field.strike;
        if (!strike) return;
        const age = time - strike.start;
        if (age < 0 || age > 1.6) return;
        const pulse = Math.exp(-Math.pow((age - .20) / .18, 2)) + (strike.echo ? .40 * Math.exp(-Math.pow((age - .67) / .24, 2)) : 0);
        const intensity = Math.min(1, pulse) * strike.strength;
        if (intensity < .008) return;
        const x = width * strike.x;
        const glow = ctx.createRadialGradient(x, 0, 0, x, 0, Math.max(width, height) * .85);
        glow.addColorStop(0, `rgba(181,210,255,${intensity * .16})`);
        glow.addColorStop(.30, `rgba(126,168,230,${intensity * .055})`);
        glow.addColorStop(1, 'rgba(126,168,230,0)');
        ctx.fillStyle = glow; ctx.fillRect(0, 0, width, height);
        // Local illumination, rather than a white flash over the entire interface.
        const paths = [strike.points, ...strike.branches];
        for (const [lineWidth, alpha] of [[7, .035], [2.4, .16], [.8, .62]]) {
            ctx.lineWidth = lineWidth; ctx.strokeStyle = `rgba(208,229,255,${intensity * alpha})`;
            paths.forEach(points => {
                ctx.beginPath(); points.forEach(([px, py], index) => index ? ctx.lineTo(px * width, py * height) : ctx.moveTo(px * width, py * height)); ctx.stroke();
            });
        }
    }

    function drawWetGlass(ctx, width, height, time, coarse) {
        const salt = stormField(ctx, time).salt;
        for (let i = 0; i < (coarse ? 6 : 14); i++) {
            const seed = i * 19.1 + salt;
            const clock = time * (.025 + rainNoise(seed) * .022) + rainNoise(seed + 11);
            const age = fraction(clock), cycle = Math.floor(clock);
            const side = i % 2;
            const x = width * (side ? .97 - rainNoise(seed + cycle) * .035 : .012 + rainNoise(seed + cycle) * .035);
            const y = age * (height + 80) - 40;
            const length = 18 + rainNoise(seed + 37) * 65;
            ctx.lineWidth = .6 + rainNoise(seed + 21);
            ctx.strokeStyle = `rgba(175,219,241,${.055 + rainNoise(seed + 5) * .065})`;
            ctx.beginPath(); ctx.moveTo(x, y - length);
            ctx.bezierCurveTo(x - 2, y - length * .5, x + 2, y - length * .3, x, y); ctx.stroke();
            ctx.fillStyle = 'rgba(190,226,248,.16)';
            ctx.beginPath(); ctx.ellipse(x, y, 1.1, 2.5, 0, 0, Math.PI * 2); ctx.fill();
        }
    }

    function sunnyField(ctx, time) {
        let field = sunnyFields.get(ctx);
        if (!field) {
            let seed = Math.floor(Math.random() * 0xffffffff) || 1;
            const random = () => {
                seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
                return seed / 0x100000000;
            };
            field = { random, salt: random() * 1000, next: time + 5 + random() * 5, flock: null };
            sunnyFields.set(ctx, field);
        }
        return field;
    }

    // Render small volumes once. Animation only moves these cached, translucent textures.
    function getCloudSprites() {
        if (cloudSprites) return cloudSprites;
        cloudSprites = [];
        if (!document.createElement) return cloudSprites;
        const hash = (x, y, z) => {
            let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647);
            n = Math.imul(n ^ (n >>> 13), 1274126177);
            return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
        };
        const mix = (a, b, t) => a + (b - a) * t;
        const noise3 = (x, y, z) => {
            const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
            const smooth = v => v * v * (3 - 2 * v);
            const fx = smooth(x - ix), fy = smooth(y - iy), fz = smooth(z - iz);
            return mix(mix(mix(hash(ix, iy, iz), hash(ix + 1, iy, iz), fx),
                mix(hash(ix, iy + 1, iz), hash(ix + 1, iy + 1, iz), fx), fy),
                mix(mix(hash(ix, iy, iz + 1), hash(ix + 1, iy, iz + 1), fx),
                    mix(hash(ix, iy + 1, iz + 1), hash(ix + 1, iy + 1, iz + 1), fx), fy), fz);
        };
        for (let variant = 0; variant < 3; variant++) {
            const canvas = document.createElement('canvas'); canvas.width = 288; canvas.height = 160;
            const paint = canvas.getContext?.('2d');
            if (!paint?.createImageData || !paint.putImageData) break;
            const nx = 96, ny = 56, nz = 32, plane = nx * ny;
            const density = new Float32Array(plane * nz), light = new Float32Array(density.length);
            const seed = 19 + variant * 47;
            const random = i => rainNoise(seed + i * 3.7);
            const billows = [];
            for (let i = 0; i < 7; i++) {
                const x = -1.15 + i * .36;
                const center = 1 - Math.abs(x) / 1.5;
                billows.push({ x: x + (random(i + 1) - .5) * .15,
                    y: .20 - center * (.17 + random(i + 11) * .28), z: (random(i + 21) - .5) * .28,
                    r: .32 + center * (.12 + random(i + 31) * .22), sy: .76 + random(i + 41) * .3 });
            }
            // Smaller off-axis billows break up the crest, tails and lower edge.
            for (let i = 0; i < 14; i++) {
                const parent = billows[i % 7], angle = random(i + 51) * Math.PI * 2;
                billows.push({ x: parent.x + Math.cos(angle) * parent.r * .68,
                    y: parent.y + Math.sin(angle) * parent.r * .64,
                    z: parent.z - .17 + random(i + 61) * .24,
                    r: .14 + random(i + 71) * .16, sy: .7 + random(i + 81) * .4 });
            }
            for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
                const px = (x / (nx - 1) - .5) * 3.8, py = (y / (ny - 1) - .5) * 2.1, pz = (z / (nz - 1) - .5) * 1.8;
                let inside = -Infinity;
                for (const b of billows) {
                    const dx = px - b.x, dy = (py - b.y) / b.sy, dz = pz - b.z;
                    inside = Math.max(inside, b.r - Math.sqrt(dx * dx + dy * dy + dz * dz));
                }
                if (inside < -.17) continue;
                const coarse = noise3(px * 3 + seed, py * 3 + 11, pz * 3 + 7);
                const fine = noise3(px * 8 + seed, py * 8, pz * 8);
                const detail = noise3(px * 15 + seed, py * 15 + 3, pz * 15);
                const edge = inside + (coarse - .5) * .22 + (fine - .5) * .10 + (detail - .5) * .04;
                density[z * plane + y * nx + x] = Math.max(0, Math.min(1, edge * 12)) * (.88 + detail * .12);
            }
            const at = (x, y, z) => x < 0 || x >= nx || y < 0 || y >= ny || z < 0 || z >= nz ? 0 : density[z * plane + y * nx + x];
            for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
                // Sunlight enters from above/right; dense lobes shade one another.
                const shadow = at(x + 5, y - 6, z - 4) * .9 + at(x + 10, y - 12, z - 8) * .65 + at(x + 19, y - 21, z - 14) * .35;
                light[z * plane + y * nx + x] = Math.exp(-shadow * 1.7);
            }
            const sample = (values, x, y, z) => {
                const ix = Math.min(nx - 2, Math.floor(x)), iy = Math.min(ny - 2, Math.floor(y)), iz = Math.min(nz - 2, Math.floor(z));
                const fx = x - ix, fy = y - iy, fz = z - iz, i = iz * plane + iy * nx + ix;
                return mix(mix(mix(values[i], values[i + 1], fx), mix(values[i + nx], values[i + nx + 1], fx), fy),
                    mix(mix(values[i + plane], values[i + plane + 1], fx), mix(values[i + plane + nx], values[i + plane + nx + 1], fx), fy), fz);
            };
            const pixels = paint.createImageData(canvas.width, canvas.height);
            for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
                const gx = x / (canvas.width - 1) * (nx - 1), gy = y / (canvas.height - 1) * (ny - 1);
                let opacity = 0, red = 0, green = 0, blue = 0;
                for (let z = 0; z < nz - 1 && opacity < .995; z++) {
                    const d = sample(density, gx, gy, z);
                    if (d < .003) continue;
                    const sun = sample(light, gx, gy, z);
                    const weight = (1 - opacity) * (1 - Math.exp(-d * .55));
                    red += weight * (189 + sun * 66); green += weight * (204 + sun * 51); blue += weight * (222 + sun * 33);
                    opacity += weight;
                }
                if (opacity < .002) continue;
                const i = (y * canvas.width + x) * 4;
                pixels.data[i] = red / opacity; pixels.data[i + 1] = green / opacity;
                pixels.data[i + 2] = blue / opacity; pixels.data[i + 3] = opacity * 255;
            }
            paint.putImageData(pixels, 0, 0); cloudSprites.push(canvas);
        }
        return cloudSprites;
    }

    function drawSunny(ctx, width, height, time, { hero, coarse, foreground, motion }) {
        const field = sunnyField(ctx, time);
        const noise = seed => rainNoise(seed + field.salt);
        const radius = hero ? 21 : foreground ? 26 : 30;
        const sunX = foreground ? width + radius * .35 : width * .87;
        const sunY = height * (hero ? .28 : .12);
        const warmth = .86 + Math.sin(time * .24 + field.salt) * .14;
        const haloRadius = foreground ? Math.min(620, width * .5) : radius * 5;
        const halo = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, haloRadius);
        halo.addColorStop(0, `rgba(255,204,105,${warmth * (foreground ? .25 : .5)})`);
        halo.addColorStop(.42, `rgba(255,218,147,${warmth * (foreground ? .065 : .14)})`);
        halo.addColorStop(1, 'rgba(255,228,173,0)');
        ctx.fillStyle = halo; ctx.fillRect(sunX - haloRadius, sunY - haloRadius, haloRadius * 2, haloRadius * 2);

        // Warm, broad shafts of light sway slowly as clouds pass over the sun.
        const reach = Math.max(width, height) * 1.25;
        const light = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, reach);
        light.addColorStop(0, `rgba(255,220,145,${foreground ? .085 : .13})`);
        light.addColorStop(.6, `rgba(255,230,181,${foreground ? .018 : .035})`);
        light.addColorStop(1, 'rgba(255,235,196,0)');
        ctx.fillStyle = light;
        for (let i = 0; i < (coarse ? 3 : 5); i++) {
            const angle = 1.78 + i * .20 + Math.sin(time * .09 + i) * .035;
            const spread = .022 + noise(i + 101) * .025;
            ctx.beginPath(); ctx.moveTo(sunX, sunY);
            ctx.lineTo(sunX + Math.cos(angle - spread) * reach, sunY + Math.sin(angle - spread) * reach);
            ctx.lineTo(sunX + Math.cos(angle + spread) * reach, sunY + Math.sin(angle + spread) * reach);
            ctx.closePath(); ctx.fill();
        }
        ctx.fillStyle = foreground ? 'rgba(255,213,114,.42)' : '#ffe5a0';
        ctx.beginPath(); ctx.arc(sunX, sunY, radius, 0, Math.PI * 2); ctx.fill();
        ctx.lineCap = 'round'; ctx.lineWidth = hero ? 1.2 : 1.5;
        for (let i = 0; i < 12; i++) {
            const angle = i / 12 * Math.PI * 2 + time * .022;
            const start = radius + 7, end = start + 6 + Math.sin(time * .4 + i) * 2;
            ctx.strokeStyle = `rgba(235,179,73,${foreground ? .14 : .28})`;
            ctx.beginPath(); ctx.moveTo(sunX + Math.cos(angle) * start, sunY + Math.sin(angle) * start);
            ctx.lineTo(sunX + Math.cos(angle) * end, sunY + Math.sin(angle) * end); ctx.stroke();
        }

        // Layered cloud volumes have lit crests, cool shaded bases and wispy edges.
        const clouds = getCloudSprites();
        for (let i = 0; i < (coarse ? 3 : 5); i++) {
            if (!clouds.length) break;
            const size = hero ? 28 + noise(i + 11) * 40 : 48 + noise(i + 11) * 58;
            const span = width + size * 4;
            const speed = (hero ? 4 : 7) + noise(i + 21) * 8;
            const x = fraction(noise(i + 31) + time * speed / span) * span - size * 2;
            const y = height * (.06 + noise(i + 41) * (hero ? .35 : .20));
            const edge = foreground ? .24 + .76 * Math.pow(Math.min(1, Math.abs(x / width - .5) * 2), 2) : 1;
            ctx.save();
            ctx.globalAlpha *= (foreground ? .42 : hero ? .80 : .66) * edge;
            const sprite = clouds[Math.floor(noise(i + 51) * clouds.length)];
            const drift = Math.sin(time * .035 + i) * size * .035;
            ctx.drawImage(sprite, x - size * 1.9, y - size * .75 + drift, size * 3.8, size * 2.1);
            ctx.restore();
        }

        // Airborne pollen follows the breeze; center particles stay faint near text.
        for (let i = 0; i < (coarse ? 12 : 30); i++) {
            const depth = .25 + noise(i + 151) * .75;
            const x = fraction(noise(i + 161) + time * (.004 + depth * .005)) * width;
            const y = fraction(noise(i + 171) - time * (.002 + depth * .002)) * height + Math.sin(time * .5 + i) * 7;
            const edge = foreground ? .2 + .8 * Math.pow(Math.abs(x / width - .5) * 2, 2) : 1;
            ctx.fillStyle = `rgba(203,160,73,${(.14 + depth * .17) * edge})`;
            ctx.beginPath(); ctx.arc(x, y, .6 + depth * 1.1, 0, Math.PI * 2); ctx.fill();
        }

        // An occasional distant flock crosses the sky, with independently beating wings.
        if (!motion || (!foreground && !hero)) return;
        if (time >= field.next) {
            const { random } = field;
            field.flock = { start: time, duration: 18 + random() * 8, direction: random() < .5 ? 1 : -1,
                y: .06 + random() * .12, count: 2 + Math.floor(random() * (coarse ? 1 : 3)), phase: random() * Math.PI * 2 };
            field.next = time + 32 + random() * 28;
        }
        const flock = field.flock;
        if (!flock) return;
        const progress = (time - flock.start) / flock.duration;
        if (progress < 0 || progress > 1) return;
        const fade = Math.min(1, progress * 8, (1 - progress) * 8);
        for (let i = 0; i < flock.count; i++) {
            const x = width * (flock.direction > 0 ? -.10 + progress * 1.20 : 1.10 - progress * 1.20) - i * 14 * flock.direction;
            const y = height * flock.y + Math.sin(progress * Math.PI * 2 + flock.phase) * 10 + i * 5;
            const wing = Math.sin(time * 5.8 + i * 1.7) * 3.5;
            ctx.lineWidth = .9; ctx.strokeStyle = `rgba(69,107,137,${fade * (foreground ? .27 : .4)})`;
            ctx.beginPath(); ctx.moveTo(x - 5, y - wing);
            ctx.quadraticCurveTo(x - 2, y - 1, x, y + 1);
            ctx.quadraticCurveTo(x + 2, y - 1, x + 5, y - wing); ctx.stroke();
        }
    }

    function drawWeather(ctx, width, height, time, scene, { hero = false, coarse = false, foreground = false, lightning = true, motion = true } = {}) {
        if (!['sunny', 'night', 'rain'].includes(scene)) return;
        ctx.save();
        if (scene === 'sunny') {
            drawSunny(ctx, width, height, time, { hero, coarse, foreground, motion });
        } else if (scene === 'rain') {
            drawStorm(ctx, width, height, time, { coarse, foreground, lightning, motion });
            drawRain(ctx, width, height, time, { hero, coarse, foreground });
            if (foreground) drawWetGlass(ctx, width, height, time, coarse);
        } else if (scene === 'night') {
            for (let i=0; i < (coarse ? 18 : 36); i++) {
                const x = (i * 137.5 + 43) % width, y = (i * 83.7 + 23) % height;
                ctx.fillStyle = `rgba(225,226,255,${.2 + (1 + Math.sin(time*.6+i))*.17})`;
                ctx.beginPath(); ctx.arc(x,y,i%5===0?1.6:.8,0,Math.PI*2); ctx.fill();
            }
        }
        if (scene === 'night') {
            const x = width * .87, y = hero ? height*.28 : height*.12, radius = hero ? 21 : 30;
            const glow = ctx.createRadialGradient(x,y,0,x,y,radius*3.2);
            glow.addColorStop(0,'rgba(220,210,255,.2)'); glow.addColorStop(1,'rgba(220,210,255,0)');
            ctx.fillStyle=glow;ctx.fillRect(x-radius*3.2,y-radius*3.2,radius*6.4,radius*6.4);
            ctx.fillStyle='#e4defa';ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fill();
        }
        ctx.restore();
    }

    function mount(canvas, { variant = 'workspace' } = {}) {
        if (!canvas || !canvas.getContext) return null;
        if (instances.has(canvas)) return instances.get(canvas);
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
        const coarse = window.matchMedia('(pointer: coarse)');
        const listeners = [];
        const particles = [];
        const ripples = [];
        const pointer = { x: 0, y: 0, active: false };
        let width = 0, height = 0, raf = null, last = 0, time = 0;
        let visible = true, suspended = false, destroyed = false;
        let targetColor = palettes[document.documentElement.dataset.colorTheme] || palettes.clay;
        let color = [...targetColor];
        const readGradientColors = () => {
            const theme = window.MailThemes?.get(document.documentElement.dataset.colorTheme);
            return (theme ? [theme.primary, theme.mint, theme.violet, theme.coral] : ['#c96442', '#168364', '#7851c2', '#c45869'])
                .map(hex => [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16)));
        };
        let targetGradientColors = readGradientColors();
        let gradientColors = targetGradientColors.map(value => [...value]);
        const strength = variant === 'workspace' ? 0.65 : 1;
        const rgba = (alpha) => `rgba(${color.map(Math.round).join(',')},${alpha * strength})`;
        const on = (target, event, handler) => {
            target.addEventListener(event, handler, { passive: true });
            listeners.push(() => target.removeEventListener(event, handler));
        };

        function resize() {
            const rect = canvas.getBoundingClientRect();
            width = Math.max(1, rect.width);
            height = Math.max(1, rect.height);
            // Keep the backing store bounded on large/Retina monitors.
            const dpr = Math.max(0.5, Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(2400000 / (width * height))));
            canvas.width = Math.round(width * dpr);
            canvas.height = Math.round(height * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            const count = variant === 'weather' ? 0 : Math.max(14, Math.min(coarse.matches ? 26 : 48, Math.round(width * height / 26000)));
            while (particles.length < count) particles.push({
                x: Math.random(), y: Math.random(), vx: (Math.random() - 0.5) * 10,
                vy: (Math.random() - 0.5) * 10, phase: Math.random() * Math.PI * 2,
                radius: 1.2 + Math.random() * 1.5
            });
            particles.length = count;
            render(0);
        }

        function render(dt) {
            time += dt;
            color = color.map((value, index) => value + (targetColor[index] - value) * (reduced.matches ? 1 : Math.min(1, dt * 5)));
            ctx.clearRect(0, 0, width, height);
            if (variant === 'weather') {
                if (['rain', 'sunny'].includes(document.documentElement.dataset.colorTheme)) {
                    drawWeather(ctx, width, height, time, document.documentElement.dataset.colorTheme, { coarse: coarse.matches, foreground: true, motion: !reduced.matches });
                }
                return;
            }
            // Four overlapping color fields flow on the existing, bounded Canvas loop.
            if (variant === 'admin') {
                const blend = reduced.matches ? 1 : Math.min(1, dt * 3);
                gradientColors = gradientColors.map((rgb, i) => rgb.map((value, channel) => value + (targetGradientColors[i][channel] - value) * blend));
                const positions = [[.12, .08], [.82, .2], [.18, .85], [.88, .88]];
                gradientColors.forEach((rgb, i) => {
                    const x = width * (positions[i][0] + Math.sin(time * .14 + i * 1.7) * .18);
                    const y = height * (positions[i][1] + Math.cos(time * .12 + i * 2.1) * .14);
                    const radius = Math.min(900, Math.max(width, height) * (.62 + Math.sin(time * .1 + i) * .06));
                    const ink = rgb.map(Math.round).join(',');
                    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
                    glow.addColorStop(0, `rgba(${ink},.30)`);
                    glow.addColorStop(.45, `rgba(${ink},.14)`);
                    glow.addColorStop(1, `rgba(${ink},0)`);
                    ctx.fillStyle = glow;
                    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
                });
            }
            for (let i = 0; variant !== 'admin' && i < 3; i++) {
                const x = width * (0.16 + i * 0.34) + Math.sin(time * 0.12 + i * 2) * width * 0.06;
                const y = height * (i % 2 ? 0.72 : 0.23) + Math.cos(time * 0.15 + i) * 35;
                const radius = Math.min(430, Math.max(width, height) * 0.4);
                const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
                glow.addColorStop(0, rgba(0.105));
                glow.addColorStop(0.5, rgba(0.035));
                glow.addColorStop(1, rgba(0));
                ctx.fillStyle = glow;
                ctx.fillRect(0, 0, width, height);
            }
            drawWeather(ctx, width, height, time, document.documentElement.dataset.colorTheme, { coarse: coarse.matches, lightning: variant !== 'admin', motion: !reduced.matches });
            // Keep sunny and rainy skies filled with their natural weather.
            if (['rain', 'sunny'].includes(document.documentElement.dataset.colorTheme)) { ripples.length = 0; return; }
            if (variant === 'admin') {
                // Three tilted orbital paths add depth without another animation loop.
                for (let orbit = 0; orbit < 3; orbit++) {
                    ctx.save();
                    ctx.translate(width * (orbit % 2 ? .85 : .12), height * (.25 + orbit * .25));
                    ctx.rotate(time * .025 + orbit * .9);
                    ctx.scale(1, .38 + orbit * .08);
                    ctx.beginPath(); ctx.arc(0, 0, 80 + orbit * 30, 0, Math.PI * 2);
                    ctx.strokeStyle = rgba(.09); ctx.lineWidth = 1; ctx.stroke();
                    const angle = time * .22 + orbit * 2;
                    ctx.beginPath(); ctx.arc(Math.cos(angle) * (80 + orbit * 30), Math.sin(angle) * (80 + orbit * 30), 3, 0, Math.PI * 2);
                    ctx.fillStyle = rgba(.25); ctx.fill(); ctx.restore();
                }
            }
            particles.forEach((p) => {
                p.x = (p.x + p.vx * dt / width + 1) % 1;
                p.y = (p.y + p.vy * dt / height + 1) % 1;
                const x = p.x * width, y = p.y * height;
                ctx.beginPath();
                ctx.arc(x, y, p.radius, 0, Math.PI * 2);
                ctx.fillStyle = rgba(0.25 + Math.sin(time + p.phase) * 0.08);
                ctx.fill();
                if (pointer.active && !reduced.matches) {
                    const distance = Math.hypot(x - pointer.x, y - pointer.y);
                    if (distance < 170) {
                        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(pointer.x, pointer.y);
                        ctx.strokeStyle = rgba(0.22 * (1 - distance / 170));
                        ctx.lineWidth = 0.8; ctx.stroke();
                    }
                }
            });
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const a = particles[i], b = particles[j];
                    const distance = Math.hypot((a.x - b.x) * width, (a.y - b.y) * height);
                    if (distance > 145) continue;
                    ctx.beginPath(); ctx.moveTo(a.x * width, a.y * height); ctx.lineTo(b.x * width, b.y * height);
                    ctx.strokeStyle = rgba(0.15 * (1 - distance / 145));
                    ctx.lineWidth = 0.7; ctx.stroke();
                }
            }
            // Small envelopes follow quiet orbital paths around the content.
            for (let i = 0; i < (coarse.matches ? 3 : 5); i++) {
                const x = width * (0.09 + i * 0.2) + Math.sin(time * 0.16 + i * 1.5) * 22;
                const y = height * (i % 2 ? 0.8 : 0.18) + Math.cos(time * 0.2 + i) * 18;
                ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(time * 0.14 + i) * 0.14);
                ctx.strokeStyle = rgba(0.19); ctx.lineWidth = 1;
                ctx.strokeRect(-10, -7, 20, 14);
                ctx.beginPath(); ctx.moveTo(-10, -7); ctx.lineTo(0, 1); ctx.lineTo(10, -7); ctx.stroke();
                ctx.restore();
            }
            for (let i = ripples.length - 1; i >= 0; i--) {
                const ripple = ripples[i]; ripple.age += dt;
                if (ripple.age >= 0.75) { ripples.splice(i, 1); continue; }
                const progress = ripple.age / 0.75;
                ctx.beginPath(); ctx.arc(ripple.x, ripple.y, 8 + 64 * (1 - Math.pow(1 - progress, 3)), 0, Math.PI * 2);
                ctx.strokeStyle = rgba(0.32 * (1 - progress)); ctx.lineWidth = 1.5; ctx.stroke();
            }
        }

        function canAnimate() { return !destroyed && !suspended && !document.hidden && visible && !reduced.matches && (variant !== 'weather' || ['rain', 'sunny'].includes(document.documentElement.dataset.colorTheme)); }
        function tick(now) {
            raf = null;
            if (!canAnimate()) return;
            const elapsed = now - last;
            if (!last || elapsed >= (coarse.matches ? 48 : ['admin', 'weather'].includes(variant) ? 32 : 22)) {
                render(last ? Math.min(elapsed / 1000, 0.05) : 0);
                last = now;
            }
            raf = requestAnimationFrame(tick);
        }
        function stop() {
            if (raf !== null) cancelAnimationFrame(raf);
            raf = null; last = 0;
        }
        function update() {
            stop();
            if (destroyed || suspended || document.hidden || !visible) return;
            if (reduced.matches) { ripples.length = 0; pointer.active = false; render(0); }
            else if (canAnimate()) raf = requestAnimationFrame(tick);
            else render(0);
        }
        on(document, 'visibilitychange', update);
        on(reduced, 'change', update);
        on(coarse, 'change', () => { resize(); update(); });
        on(window, 'pagehide', () => { suspended = true; stop(); });
        on(window, 'pageshow', () => { suspended = false; update(); });
        on(window, 'pointermove', (event) => {
            if (variant === 'weather' || coarse.matches || reduced.matches) return;
            const rect = canvas.getBoundingClientRect();
            pointer.x = event.clientX - rect.left; pointer.y = event.clientY - rect.top; pointer.active = true;
        });
        on(document.documentElement, 'pointerleave', () => { pointer.active = false; });
        on(window, 'blur', () => { pointer.active = false; });
        on(document, 'click', (event) => {
            if (variant === 'weather' || reduced.matches || !event.target.closest?.('button, .btn, [role="tab"]') || !event.detail) return;
            const rect = canvas.getBoundingClientRect();
            ripples.push({ x: event.clientX - rect.left, y: event.clientY - rect.top, age: 0 });
            if (ripples.length > 4) ripples.shift();
        });
        const themeObserver = new MutationObserver(() => {
            targetColor = palettes[document.documentElement.dataset.colorTheme] || palettes.clay;
            targetGradientColors = readGradientColors();
            if (variant === 'weather') update();
            else if (reduced.matches) render(0);
        });
        themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-color-theme'] });
        const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
        resizeObserver?.observe(canvas);
        if (!resizeObserver) on(window, 'resize', resize);
        const intersection = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting; update();
        }) : null;
        intersection?.observe(canvas);
        const controller = {
            destroy() {
                if (destroyed) return;
                destroyed = true; stop();
                listeners.forEach((remove) => remove());
                themeObserver.disconnect(); resizeObserver?.disconnect(); intersection?.disconnect();
                ctx.clearRect(0, 0, width, height);
                rainFields.delete(ctx); stormFields.delete(ctx); sunnyFields.delete(ctx);
                instances.delete(canvas);
            }
        };
        instances.set(canvas, controller);
        resize(); update();
        return controller;
    }
    const activeTransitions = new Map();
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    preference.addEventListener('change', () => {
        if (preference.matches) {
            activeTransitions.forEach((animation) => animation.cancel());
            activeTransitions.clear();
        }
    });
    function reveal(element, direction = 1) {
        if (!element || !element.animate || preference.matches) return;
        activeTransitions.get(element)?.cancel();
        const animation = element.animate([
            { opacity: 0, transform: `translateY(${direction * 8}px)` },
            { opacity: 1, transform: 'translateY(0)' }
        ], { duration: 280, easing: 'cubic-bezier(.22,1,.36,1)' });
        activeTransitions.set(element, animation);
        const finish = () => { if (activeTransitions.get(element) === animation) activeTransitions.delete(element); };
        animation.onfinish = finish;
        animation.oncancel = finish;
    }
    window.MailMotion = { mount, reveal, drawWeather };
})();
