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
    let cloudSprites, sunSprite, stormSprites, glassSprite, rainSprite;
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
    function getRainSprite() {
        if (rainSprite || !document.createElement) return rainSprite;
        const canvas = document.createElement('canvas'); canvas.width = 10; canvas.height = 96;
        const paint = canvas.getContext('2d');
        if (!paint?.createImageData) return null;
        const pixels = paint.createImageData(10, 96);
        for (let y = 0; y < 96; y++) for (let x = 0; x < 10; x++) {
            const progress = y/96, center = (x-4.5)/(1.1 + progress*.7);
            const alpha = Math.exp(-center*center*1.6) * Math.pow(progress, .9) * Math.min(1, (96-y)/6);
            const i = (y*10+x)*4;
            pixels.data[i] = 169 + progress*32; pixels.data[i+1] = 215 + progress*17;
            pixels.data[i+2] = 237 + progress*12; pixels.data[i+3] = alpha*255;
        }
        paint.putImageData(pixels, 0, 0); rainSprite = canvas;
        return canvas;
    }
    function drawRain(ctx, width, height, time, { hero, coarse, foreground, illumination = 0 }) {
        const salt = stormField(ctx, time).salt;
        const sprite = getRainSprite();
        const noise = seed => rainNoise(seed + salt);
        const count = Math.min(coarse ? 64 : 170, Math.max(coarse ? 32 : 64, Math.round(width * height / (hero ? 2300 : foreground ? 7000 : 6500))));
        let drops = rainFields.get(ctx);
        if (!drops || drops.length !== count) {
            drops = Array.from({ length: count }, (_, i) => {
                const depth = .16 + (i % 3) * .28 + noise(i + 3) * .26;
                return { seed: i + 1, depth, phase: noise(i + 71), speed: 180 + depth * 370 + noise(i + 29) * 140,
                    length: 5 + depth * depth * 37 + noise(i + 47) * 8, alpha: .08 + depth * .22, width: .35 + depth * .9 };
            });
            rainFields.set(ctx, drops);
        }
        const wind = windAt(time);
        // Low, wind-driven banks of mist, stretched horizontally rather than a full-screen blur.
        const mistCount = coarse ? 2 : 3;
        for (let i = 0; i < mistCount; i++) {
            const x = width * (.18 + i * .36) + Math.sin(time * .17 + i * 2.3) * width * .2;
            const y = height * (.18 + i * .32) + Math.sin(time * .23 + i) * height * .04;
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
            const edge = foreground ? .12 + .88 * Math.pow(Math.min(1, Math.abs(x / width - .5) * 2), 2) : 1;
            const opacity = drop.alpha * shower * edge * (hero ? 1.3 : 1) * (1 + illumination * .6);
            if (sprite) {
                // Soft optical streaks taper into a brighter head instead of hard, uniform lines.
                ctx.save(); ctx.translate(x, y); ctx.rotate(-Math.atan(slant)); ctx.globalAlpha *= opacity;
                ctx.drawImage(sprite, -drop.width*2, -length, drop.width*4, length); ctx.restore();
            } else {
                ctx.strokeStyle = `rgba(169,215,237,${opacity})`; ctx.lineWidth = drop.width;
                ctx.beginPath(); ctx.moveTo(x - slant * length, y - length); ctx.lineTo(x, y); ctx.stroke();
            }
        });
        // Soft, fragmented sky reflections sit low in a shallow wet ground plane.
        const floor = foreground ? .92 : hero ? .8 : .89;
        for (let i = 0; i < (coarse ? 2 : 4); i++) {
            const x = width * (.07 + noise(i + 801) * .86), y = height * (.95 + noise(i + 811) * .04);
            const radius = Math.max(45, Math.min(220, width * .18));
            ctx.save(); ctx.translate(x, y); ctx.scale(1, .075);
            const reflection = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
            reflection.addColorStop(0, `rgba(125,183,210,${(foreground ? .045 : .12) * (1 + illumination)})`);
            reflection.addColorStop(1, 'rgba(125,183,210,0)');
            ctx.fillStyle = reflection; ctx.fillRect(-radius, -radius, radius*2, radius*2); ctx.restore();
        }
        // Impacts expand into several fading rings; perspective flattens the distant ones.
        const impacts = coarse ? 5 : hero ? 14 : 18;
        for (let i = 0; i < impacts; i++) {
            const clock = time * (.42 + noise(i + 301) * .55) + noise(i + 401);
            const cycle = Math.floor(clock), age = fraction(clock);
            if (age > .68) continue;
            const progress = age / .68;
            const x = noise(i + cycle * 31.7 + 501) * width;
            const distance = noise(i + cycle * 13.1 + 601);
            const y = height * (floor + distance * (1-floor) * .95);
            const radius = 2 + progress * (8 + distance * 15);
            const flatten = .12 + distance * .15;
            const edge = foreground ? .2 + .8 * Math.abs(x/width-.5)*2 : 1;
            const opacity = Math.sin(progress * Math.PI) * (hero ? .26 : foreground ? .16 : .2) * edge;
            ctx.lineWidth = .6;
            ctx.strokeStyle = `rgba(157,215,226,${opacity})`;
            ctx.beginPath(); ctx.ellipse(x, y, radius, radius * flatten, 0, 0, Math.PI * 2); ctx.stroke();
            if (progress > .2) {
                ctx.strokeStyle = `rgba(157,215,226,${opacity * .45})`;
                ctx.beginPath(); ctx.ellipse(x, y, radius * .63, radius * .63 * flatten, 0, 0, Math.PI * 2); ctx.stroke();
            }
            if (progress < .3) {
                const splash = Math.sin(progress / .3 * Math.PI) * (3 + distance * 4);
                ctx.beginPath(); ctx.moveTo(x - 3, y - splash); ctx.lineTo(x, y); ctx.lineTo(x + 3 + wind * .015, y - splash * .75); ctx.stroke();
                ctx.fillStyle = `rgba(191,225,242,${opacity})`;
                ctx.beginPath(); ctx.arc(x + 2 + wind * .014, y - splash - 2, .65, 0, Math.PI * 2); ctx.fill();
            }
        }
    }

    function getStormSprites() {
        if (stormSprites) return stormSprites;
        stormSprites = getCloudSprites().map(source => {
            const canvas = document.createElement('canvas'), lit = document.createElement('canvas');
            canvas.width = lit.width = source.canvas.width; canvas.height = lit.height = source.canvas.height;
            const paint = canvas.getContext('2d'), light = lit.getContext('2d');
            if (!paint || !light) return null;
            const pixels = paint.createImageData(canvas.width, canvas.height);
            const highlights = paint.createImageData(canvas.width, canvas.height);
            for (let i = 0; i < source.opacity.length; i++) {
                const shade = source.shade[i] / 255, offset = i * 4;
                // Preserve the actual cloud volume, with cool lit crests and dense charcoal bases.
                pixels.data[offset] = 13 + shade * 58;
                pixels.data[offset+1] = 24 + shade * 62;
                pixels.data[offset+2] = 42 + shade * 68;
                pixels.data[offset+3] = source.opacity[i];
                highlights.data[offset] = 103 + shade * 105;
                highlights.data[offset+1] = 134 + shade * 96;
                highlights.data[offset+2] = 179 + shade * 71;
                highlights.data[offset+3] = source.opacity[i];
            }
            paint.putImageData(pixels, 0, 0); light.putImageData(highlights, 0, 0);
            return { canvas, lit };
        }).filter(Boolean);
        return stormSprites;
    }

    function drawStorm(ctx, width, height, time, { hero, coarse, foreground, lightning, motion }) {
        const field = stormField(ctx, time);
        if (lightning && motion && time >= field.next) {
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
            field.strike = { start: time, points, branches, x: points[0][0], echo: random() > .4, strength: .65 + random() * .35 };
            field.next = time + 8 + random() * 16;
        }
        const strike = field.strike;
        const age = strike ? time - strike.start : -1;
        const pulse = age >= 0 && age < 1.6 && motion && lightning ?
            Math.exp(-Math.pow((age-.20)/.18, 2)) + (strike.echo ? .40 * Math.exp(-Math.pow((age-.67)/.24, 2)) : 0) : 0;
        const intensity = Math.min(1, pulse) * (strike?.strength || 0);
        const sprites = getStormSprites();
        const count = coarse ? 4 : 7;
        const noise = seed => rainNoise(seed + field.salt);
        for (let i = 0; i < count; i++) {
            const near = i >= (coarse ? 2 : 4);
            const cloudWidth = Math.max(hero ? 210 : 330, width * (near ? .85 : .7)) * (.85 + noise(i+50)*.3);
            const span = width + cloudWidth;
            const drift = time * (near ? 7 : 2.6) + Math.sin(time * .08 + i) * 9;
            const x = fraction(i/count + noise(i+10)*.12 + drift/span) * span - cloudWidth;
            const cloudHeight = Math.min(hero ? height*.95 : height*.46, cloudWidth * (near ? .32 : .4));
            const y = -cloudHeight * .37 + height * (near ? .04 : -.02) + noise(i+30)*height*.055;
            const edge = foreground ? .3 + .7*Math.pow(Math.min(1, Math.abs((x+cloudWidth*.5)/width-.5)*2), 2) : 1;
            const alpha = (foreground ? (near ? .3 : .24) : near ? .8 : .58) * edge;
            const sprite = sprites[i % sprites.length];
            if (sprite) {
                ctx.save(); ctx.globalAlpha *= alpha;
                ctx.drawImage(sprite.canvas, x, y, cloudWidth, cloudHeight);
                if (intensity > .008) {
                    // The same flash lights only nearby cloud volumes; no independent white overlay.
                    const proximity = Math.exp(-Math.abs((x+cloudWidth*.5)/width-strike.x)*3.6);
                    ctx.globalAlpha *= intensity * proximity * .8;
                    ctx.drawImage(sprite.lit, x, y, cloudWidth, cloudHeight);
                }
                ctx.restore();
            }
        }
        if (intensity < .008) return 0;
        const x = width * strike.x;
        const glow = ctx.createRadialGradient(x, 0, 0, x, 0, Math.max(width, height)*.65);
        glow.addColorStop(0, `rgba(181,210,255,${intensity*.14})`);
        glow.addColorStop(.30, `rgba(126,168,230,${intensity*.045})`);
        glow.addColorStop(1, 'rgba(126,168,230,0)');
        ctx.fillStyle = glow; ctx.fillRect(0, 0, width, height);
        const paths = [strike.points, ...strike.branches];
        for (const [lineWidth, alpha] of [[7, .035], [2.4, .16], [.8, .62]]) {
            ctx.lineWidth = lineWidth; ctx.strokeStyle = `rgba(208,229,255,${intensity * alpha})`;
            paths.forEach(points => {
                ctx.beginPath(); points.forEach(([px, py], index) => index ? ctx.lineTo(px*width, py*height) : ctx.moveTo(px*width, py*height)); ctx.stroke();
            });
        }
        return intensity;
    }

    function getGlassSprite() {
        if (glassSprite || !document.createElement) return glassSprite;
        const canvas = document.createElement('canvas'); canvas.width = 40; canvas.height = 56;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        // A transparent lens: dark rim, inverted cool light, and a small reflected sky highlight.
        const lens = ctx.createRadialGradient(24, 36, 1, 20, 28, 17);
        lens.addColorStop(0, 'rgba(194,224,244,.36)');
        lens.addColorStop(.35, 'rgba(103,155,183,.13)');
        lens.addColorStop(.68, 'rgba(12,25,42,.03)');
        lens.addColorStop(.91, 'rgba(5,12,24,.35)');
        lens.addColorStop(1, 'rgba(12,25,42,0)');
        ctx.fillStyle = lens; ctx.beginPath(); ctx.ellipse(20, 29, 15, 22, -.12, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = 'rgba(196,225,246,.48)'; ctx.lineWidth = 1.1;
        ctx.beginPath(); ctx.ellipse(20, 29, 13, 19, -.12, Math.PI*1.08, Math.PI*1.64); ctx.stroke();
        ctx.fillStyle = 'rgba(222,242,255,.6)'; ctx.beginPath(); ctx.ellipse(14, 17, 2, 3.5, .4, 0, Math.PI*2); ctx.fill();
        glassSprite = canvas; return canvas;
    }

    function drawWetGlass(ctx, width, height, time, coarse) {
        const salt = stormField(ctx, time).salt, sprite = getGlassSprite();
        for (let i = 0; i < (coarse ? 10 : 24); i++) {
            const seed = i*19.1 + salt;
            const size = 2 + rainNoise(seed+31)*4;
            const clock = time*(.012 + rainNoise(seed)*.018) + rainNoise(seed+11);
            const age = fraction(clock), cycle = Math.floor(clock);
            // Surface tension pins small drops, then larger beads slide with a slight meander.
            const pinned = i%3 === 0;
            const travel = pinned ? rainNoise(seed+45) : age*age;
            const side = i%2;
            const x = width*(side ? .988-rainNoise(seed+cycle)*.065 : .012+rainNoise(seed+cycle)*.065) + Math.sin(travel*11+seed)*1.5;
            const y = travel*(height+70)-35;
            const length = pinned ? 0 : 15 + size*7;
            if (length) {
                ctx.lineWidth = size*.35;
                ctx.strokeStyle = `rgba(163,207,231,${.045 + size*.008})`;
                ctx.beginPath(); ctx.moveTo(x-1, y-length);
                ctx.bezierCurveTo(x-3, y-length*.5, x+2, y-length*.3, x, y); ctx.stroke();
            }
            if (sprite) {
                ctx.save(); ctx.globalAlpha *= .55 + size*.05;
                ctx.drawImage(sprite, x-size, y-size*1.4, size*2, size*2.8); ctx.restore();
            } else {
                ctx.fillStyle = 'rgba(190,226,248,.16)';
                ctx.beginPath(); ctx.ellipse(x, y, size*.35, size*.8, 0, 0, Math.PI*2); ctx.fill();
            }
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
            paint.putImageData(pixels, 0, 0);
            // Keep optical depth for solar occlusion and a thin-edge light texture.
            const opacity = new Uint8Array(canvas.width * canvas.height), shade = new Uint8Array(opacity.length);
            const rim = document.createElement('canvas'); rim.width = canvas.width; rim.height = canvas.height;
            const rimPaint = rim.getContext('2d'), rimPixels = paint.createImageData(canvas.width, canvas.height);
            for (let i = 0; i < opacity.length; i++) {
                const a = pixels.data[i * 4 + 3] / 255;
                opacity[i] = pixels.data[i * 4 + 3];
                shade[i] = Math.max(0, (pixels.data[i * 4] - 189) / 66 * 255);
                rimPixels.data[i * 4] = 255; rimPixels.data[i * 4 + 1] = 250; rimPixels.data[i * 4 + 2] = 232;
                rimPixels.data[i * 4 + 3] = Math.pow(4 * a * (1 - a), 1.5) * 160;
            }
            rimPaint?.putImageData(rimPixels, 0, 0);
            cloudSprites.push({ canvas, opacity, shade, rim: rimPaint ? rim : null });
        }
        return cloudSprites;
    }

    function paintSun(ctx, x, y, radius) {
        const bloom = ctx.createRadialGradient(x, y, 0, x, y, radius * 4);
        bloom.addColorStop(0, 'rgba(255,251,233,.48)');
        bloom.addColorStop(.24, 'rgba(255,246,217,.30)');
        bloom.addColorStop(.4, 'rgba(255,239,195,.12)');
        bloom.addColorStop(.65, 'rgba(255,232,180,.035)');
        bloom.addColorStop(1, 'rgba(255,232,180,0)');
        ctx.fillStyle = bloom; ctx.fillRect(x - radius * 4, y - radius * 4, radius * 8, radius * 8);
        const disc = ctx.createRadialGradient(x, y, 0, x, y, radius * 1.06);
        disc.addColorStop(0, '#fffffc'); disc.addColorStop(.65, '#fffefa');
        disc.addColorStop(.86, 'rgba(255,249,228,.99)'); disc.addColorStop(.93, 'rgba(255,243,207,.92)');
        disc.addColorStop(.98, 'rgba(255,241,201,.45)'); disc.addColorStop(1, 'rgba(255,241,201,0)');
        ctx.fillStyle = disc; ctx.fillRect(x - radius * 1.06, y - radius * 1.06, radius * 2.12, radius * 2.12);
    }

    function sunLayer(field) {
        if (field.sunLayer) return field.sunLayer;
        if (!document.createElement) return null;
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        if (!sunSprite) {
            const sprite = document.createElement('canvas'); sprite.width = sprite.height = 256;
            const paint = sprite.getContext('2d');
            if (!paint) return null;
            paintSun(paint, 128, 128, 32); sunSprite = sprite;
        }
        field.sunLayer = { canvas, ctx };
        return field.sunLayer;
    }

    function cloudOpacity(cloud, x, y) {
        const { sprite, left, top, width, height } = cloud;
        const px = (x - left) / width * (sprite.canvas.width - 1), py = (y - top) / height * (sprite.canvas.height - 1);
        if (px < 0 || py < 0 || px >= sprite.canvas.width - 1 || py >= sprite.canvas.height - 1) return 0;
        const ix = Math.floor(px), iy = Math.floor(py), fx = px - ix, fy = py - iy;
        const i = iy * sprite.canvas.width + ix, a = sprite.opacity, row = sprite.canvas.width;
        return ((a[i] * (1 - fx) + a[i + 1] * fx) * (1 - fy) + (a[i + row] * (1 - fx) + a[i + row + 1] * fx) * fy) / 255;
    }

    function drawSunny(ctx, width, height, time, { hero, coarse, foreground, motion }) {
        const field = sunnyField(ctx, time);
        const noise = seed => rainNoise(seed + field.salt);
        const radius = hero ? 21 : foreground ? 26 : 30;
        const sunX = foreground ? width + radius * .35 : width * .87;
        const sunY = height * (hero ? .28 : .12);

        // Layered cloud volumes have lit crests, cool shaded bases and wispy edges.
        const clouds = getCloudSprites(), layout = [];
        for (let i = 0; i < (coarse ? 3 : 5); i++) {
            if (!clouds.length) break;
            const size = hero ? 28 + noise(i + 11) * 40 : 48 + noise(i + 11) * 58;
            const span = width + size * 4;
            const speed = (hero ? 4 : 7) + noise(i + 21) * 8;
            const x = fraction(noise(i + 31) + time * speed / span) * span - size * 2;
            const y = height * (.06 + noise(i + 41) * (hero ? .35 : .20));
            const edge = foreground ? .24 + .76 * Math.pow(Math.min(1, Math.abs(x / width - .5) * 2), 2) : 1;
            const sprite = clouds[Math.floor(noise(i + 51) * clouds.length)];
            const drift = Math.sin(time * .035 + i) * size * .035;
            layout.push({ sprite, left: x - size * 1.9, top: y - size * .75 + drift, width: size * 3.8, height: size * 2.1,
                alpha: (foreground ? .42 : hero ? .80 : .66) * edge });
        }

        // Sample the solar disc, so atmospheric light follows passing clouds rather than a pulse.
        const opticalStrength = foreground ? .72 : .97;
        let visibility = 0;
        for (let i = 0; i < 9; i++) {
            const angle = i * Math.PI / 4, distance = i ? radius * .72 : 0;
            let transmission = 1;
            for (const cloud of layout) transmission *= 1 - cloudOpacity(cloud, sunX + Math.cos(angle) * distance, sunY + Math.sin(angle) * distance) * opticalStrength;
            visibility += transmission / 9;
        }
        const haloRadius = foreground ? Math.min(620, width * .5) : radius * 8;
        const light = (foreground ? .17 : .28) * (.25 + visibility * .75);
        const halo = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, haloRadius);
        halo.addColorStop(0, `rgba(255,242,207,${light})`);
        halo.addColorStop(.22, `rgba(255,237,192,${light * .5})`);
        halo.addColorStop(.55, `rgba(255,232,180,${light * .12})`);
        halo.addColorStop(1, 'rgba(255,232,180,0)');
        ctx.fillStyle = halo; ctx.fillRect(sunX - haloRadius, sunY - haloRadius, haloRadius * 2, haloRadius * 2);

        // Mask only a small cached solar patch; never read back or blur the full viewport.
        const extent = radius * 4, left = sunX - extent, top = sunY - extent, scale = 256 / (extent * 2);
        const nearby = layout.filter(cloud => cloud.left < sunX + extent && cloud.left + cloud.width > left && cloud.top < sunY + extent && cloud.top + cloud.height > top);
        const layer = sunLayer(field);
        ctx.save(); ctx.globalAlpha *= foreground ? .62 : 1;
        if (layer) {
            const paint = layer.ctx;
            paint.clearRect(0, 0, 256, 256); paint.drawImage(sunSprite, 0, 0);
            paint.save(); paint.globalCompositeOperation = 'destination-out'; paint.globalAlpha = opticalStrength;
            for (const cloud of nearby) paint.drawImage(cloud.sprite.canvas, (cloud.left - left) * scale, (cloud.top - top) * scale, cloud.width * scale, cloud.height * scale);
            paint.restore(); ctx.drawImage(layer.canvas, left, top, extent * 2, extent * 2);
        } else paintSun(ctx, sunX, sunY, radius);
        ctx.restore();
        for (const cloud of layout) {
            ctx.save(); ctx.globalAlpha *= cloud.alpha;
            ctx.drawImage(cloud.sprite.canvas, cloud.left, cloud.top, cloud.width, cloud.height); ctx.restore();
        }
        // Backlight only translucent wisps close to the sun; dense cloud bodies stay shaded.
        if (layer && nearby.length) {
            const paint = layer.ctx;
            paint.clearRect(0, 0, 256, 256); paint.save();
            for (const cloud of nearby) {
                if (!cloud.sprite.rim) continue;
                paint.globalAlpha = cloud.alpha;
                paint.drawImage(cloud.sprite.rim, (cloud.left - left) * scale, (cloud.top - top) * scale, cloud.width * scale, cloud.height * scale);
            }
            paint.globalAlpha = 1; paint.globalCompositeOperation = 'destination-in';
            const rimLight = paint.createRadialGradient(128, 128, 0, 128, 128, 100);
            rimLight.addColorStop(0, `rgba(255,255,255,${.3 + visibility * .5})`);
            rimLight.addColorStop(.4, 'rgba(255,255,255,.22)'); rimLight.addColorStop(1, 'rgba(255,255,255,0)');
            paint.fillStyle = rimLight; paint.fillRect(0, 0, 256, 256); paint.restore();
            ctx.drawImage(layer.canvas, left, top, extent * 2, extent * 2);
        }
        ctx.lineCap = 'round';

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

    const nightFields = new WeakMap();
    let moonSprite, nightCloudSprites;
    const smooth = value => { const v = Math.max(0, Math.min(1, value)); return v*v*(3-2*v); };
    function surfaceNoise(x, y) {
        const ix = Math.floor(x), iy = Math.floor(y), fx = smooth(x-ix), fy = smooth(y-iy);
        const a = rainNoise(ix + iy*57.3), b = rainNoise(ix+1 + iy*57.3);
        const c = rainNoise(ix + (iy+1)*57.3), d = rainNoise(ix+1 + (iy+1)*57.3);
        return (a+(b-a)*fx)*(1-fy)+(c+(d-c)*fx)*fy;
    }
    function getMoonSprite() {
        if (moonSprite || !document.createElement) return moonSprite;
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
        const paint = canvas.getContext('2d');
        if (!paint?.createImageData) return null;
        const pixels = paint.createImageData(256, 256);
        // A front-lit full moon: faint maria and crater detail, without a dark terminator.
        const maria = [[-.28,-.38,.27,.28],[.13,-.46,.23,.19],[.38,-.2,.2,.24],[-.46,.01,.22,.34],[-.18,.16,.23,.21],[.24,.04,.14,.13]];
        const craters = Array.from({length:72},(_,i)=>{
            const angle = rainNoise(i+311)*Math.PI*2, distance = Math.sqrt(rainNoise(i+441))*.95;
            return {x:Math.cos(angle)*distance,y:Math.sin(angle)*distance,r:.012+Math.pow(rainNoise(i+671),2)*.095};
        });
        for (let y=0;y<256;y++) for (let x=0;x<256;x++) {
            const nx=(x-127.5)/120, ny=(y-127.5)/120, rr=nx*nx+ny*ny;
            if (rr>=1) continue;
            const terrain=surfaceNoise(nx*8+21,ny*8+13)*.6+surfaceNoise(nx*23+9,ny*23+3)*.4;
            let mare=0, relief=0;
            for (const [mx,my,rx,ry] of maria) {
                const distance=Math.hypot((nx-mx)/rx,(ny-my)/ry);
                mare=Math.max(mare,1-smooth((distance+(terrain-.5)*.5-.55)/.5));
            }
            for (const crater of craters) {
                const dx=nx-crater.x, dy=ny-crater.y, distance=Math.hypot(dx,dy)/crater.r;
                if (distance>1.3) continue;
                const rim=Math.exp(-Math.pow((distance-.94)/.13,2));
                const directional=(dx*.8-dy*.6)/Math.max(crater.r*.25,Math.hypot(dx,dy));
                relief+=rim*(.06+directional*.06)-Math.exp(-Math.pow(distance/.65,4))*.06;
            }
            const illumination=1-rr*.025;
            const albedo=.965-mare*.085+(terrain-.5)*.035+(surfaceNoise(nx*85,ny*85)-.5)*.008+relief*.18;
            const value=Math.max(0,Math.min(1,albedo*illumination));
            const index=(y*256+x)*4;
            pixels.data[index]=246*value; pixels.data[index+1]=245*value; pixels.data[index+2]=238*value;
            pixels.data[index+3]=smooth((1-Math.sqrt(rr))*18)*255;
        }
        paint.putImageData(pixels,0,0); moonSprite=canvas; return canvas;
    }
    function getNightCloudSprites() {
        if (nightCloudSprites) return nightCloudSprites;
        nightCloudSprites=getCloudSprites().map(source=>{
            const canvas=document.createElement('canvas'); canvas.width=source.canvas.width; canvas.height=source.canvas.height;
            const paint=canvas.getContext('2d'); if (!paint) return null;
            const pixels=paint.createImageData(canvas.width,canvas.height);
            for (let i=0;i<source.opacity.length;i++) {
                const light=source.shade[i]/255, offset=i*4;
                pixels.data[offset]=38+light*64; pixels.data[offset+1]=51+light*65; pixels.data[offset+2]=75+light*63;
                pixels.data[offset+3]=source.opacity[i];
            }
            paint.putImageData(pixels,0,0); return {canvas,opacity:source.opacity};
        }).filter(Boolean);
        return nightCloudSprites;
    }
    function nightField(ctx,time) {
        let field=nightFields.get(ctx);
        if (!field) {
            const salt=Math.random()*1000;
            const stars=Array.from({length:150},(_,i)=>({x:rainNoise(i+salt),y:rainNoise(i+salt+701),
                magnitude:rainNoise(i+salt+173),phase:rainNoise(i+salt+811)*Math.PI*2,warm:rainNoise(i+salt+923)>.8}));
            field={salt,stars,next:time+12+rainNoise(salt)*9,meteor:null,layer:null};
            nightFields.set(ctx,field);
        }
        return field;
    }
    function drawNightSky(ctx,width,height,time,{hero,coarse,foreground,motion}) {
        const field=nightField(ctx,time), sprites=getNightCloudSprites(), moon=foreground?null:getMoonSprite();
        const noise=seed=>rainNoise(seed+field.salt);
        const radius=hero?Math.min(22,height*.11):26;
        const moonX=width*(hero?.77:.86), moonY=height*(hero?.28:.16);
        const clouds=[];
        for (let i=0;i<(coarse?2:4);i++) {
            if (!sprites.length) break;
            const size=(hero?160:260)+noise(i+21)*(hero?110:220);
            const span=width+size, speed=2+noise(i+31)*4;
            const x=fraction(noise(i+41)+time*speed/span)*span-size;
            const h=size*(.20+noise(i+51)*.08);
            const y=height*(.03+noise(i+61)*.18)-h*.3;
            clouds.push({sprite:sprites[i%sprites.length],left:x,top:y,width:size,height:h,alpha:foreground?.13:hero?.34:.25});
        }
        // Optical depth comes from the moving cloud texture, including at the moon's edge.
        const transmission=(x,y)=>clouds.reduce((light,cloud)=>light*(1-cloudOpacity(cloud,x,y)*cloud.alpha*1.8),1);
        let visibility=0;
        for (let i=0;i<9;i++) {
            const a=i*Math.PI/4, r=i?radius*.7:0;
            visibility+=transmission(moonX+Math.cos(a)*r,moonY+Math.sin(a)*r)/9;
        }
        // The foreground carries only thin clouds and sparse stars, avoiding a second moon over controls.
        if (!foreground) {
            const halo=ctx.createRadialGradient(moonX,moonY,0,moonX,moonY,radius*6);
            halo.addColorStop(0,`rgba(222,228,238,${.20*visibility})`);
            halo.addColorStop(.16,`rgba(207,218,235,${.14*visibility})`);
            halo.addColorStop(.30,`rgba(181,202,231,${.055*visibility})`);
            halo.addColorStop(.60,`rgba(145,173,214,${.015*visibility})`);
            halo.addColorStop(1,'rgba(145,173,214,0)');
            ctx.fillStyle=halo; ctx.fillRect(moonX-radius*6,moonY-radius*6,radius*12,radius*12);
        }
        const count=coarse?50:hero?90:150;
        for (const star of field.stars.slice(0,count)) {
            const x=star.x*width, y=star.y*height;
            const distance=Math.hypot(x-moonX,y-moonY);
            if (!foreground && distance<radius*1.05) continue;
            const edge=foreground?.12+.88*Math.pow(Math.abs(x/width-.5)*2,2):1;
            const washed=foreground?1:1-.75*Math.exp(-distance*distance/(radius*radius*35));
            const twinkle=motion?1+Math.sin(time*(.35+star.magnitude*.4)+star.phase)*.10:1;
            const opacity=(.11+Math.pow(star.magnitude,3)*.64)*edge*washed*twinkle*transmission(x,y);
            const r=.35+Math.pow(star.magnitude,4)*.9;
            const ink=star.warm?'244,229,205':'206,221,244';
            if (star.magnitude>.95) {
                const glow=ctx.createRadialGradient(x,y,0,x,y,r*3.6);
                glow.addColorStop(0,`rgba(${ink},${opacity*.22})`); glow.addColorStop(1,`rgba(${ink},0)`);
                ctx.fillStyle=glow; ctx.fillRect(x-r*4,y-r*4,r*8,r*8);
            }
            ctx.fillStyle=`rgba(${ink},${opacity})`; ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
        }
        const extent=radius*256/240;
        if (moon && !foreground) {
            if (!field.layer) {
                const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
                const paint=canvas.getContext('2d'); if (paint) field.layer={canvas,paint};
            }
            ctx.save();
            if (field.layer) {
                const {canvas,paint}=field.layer, left=moonX-extent,top=moonY-extent,scale=256/(extent*2);
                paint.clearRect(0,0,256,256);paint.drawImage(moon,0,0);
                paint.save();paint.globalCompositeOperation='destination-out';
                for (const cloud of clouds) {
                    if (cloud.left>moonX+extent||cloud.left+cloud.width<left||cloud.top>moonY+extent||cloud.top+cloud.height<top) continue;
                    paint.globalAlpha=cloud.alpha*1.8;
                    paint.drawImage(cloud.sprite.canvas,(cloud.left-left)*scale,(cloud.top-top)*scale,cloud.width*scale,cloud.height*scale);
                }
                paint.restore();ctx.drawImage(canvas,left,top,extent*2,extent*2);
            } else ctx.drawImage(moon,moonX-extent,moonY-extent,extent*2,extent*2);
            ctx.restore();
        } else if (!foreground) {
            ctx.fillStyle='rgba(237,236,229,.94)';ctx.beginPath();ctx.arc(moonX,moonY,radius,0,Math.PI*2);ctx.fill();
        }
        for (const cloud of clouds) {
            ctx.save();ctx.globalAlpha*=cloud.alpha;
            ctx.drawImage(cloud.sprite.canvas,cloud.left,cloud.top,cloud.width,cloud.height);ctx.restore();
        }
        // An occasional distant meteor, with irregular quiet intervals rather than a repeating orbit.
        if (!motion||(!foreground&&!hero)) return;
        if (time>=field.next) {
            field.meteor={start:time,x:.16+noise(time+83)*.55,y:.05+noise(time+97)*.16};
            field.next=time+28+noise(time+113)*30;
        }
        const meteor=field.meteor;
        if (!meteor) return;
        const age=(time-meteor.start)/.9;
        if (age<0||age>1) return;
        const opacity=Math.sin(age*Math.PI)*(foreground?.2:.4);
        const x=width*(meteor.x+age*.16),y=height*meteor.y+age*height*.12;
        for(let i=0;i<8;i++) {
            ctx.strokeStyle=`rgba(210,229,248,${opacity*(1-i/8)})`;ctx.lineWidth=.8;
            ctx.beginPath();ctx.moveTo(x-i*5,y-i*1.8);ctx.lineTo(x-(i+1)*5,y-(i+1)*1.8);ctx.stroke();
        }
    }

    function drawWeather(ctx, width, height, time, scene, { hero = false, coarse = false, foreground = false, lightning = true, motion = true } = {}) {
        if (!['sunny', 'night', 'rain'].includes(scene)) return;
        ctx.save();
        if (scene === 'sunny') {
            drawSunny(ctx, width, height, time, { hero, coarse, foreground, motion });
        } else if (scene === 'rain') {
            const illumination = drawStorm(ctx, width, height, time, { hero, coarse, foreground, lightning, motion });
            drawRain(ctx, width, height, time, { hero, coarse, foreground, illumination });
            if (foreground) drawWetGlass(ctx, width, height, time, coarse);
        } else if (scene === 'night') {
            drawNightSky(ctx, width, height, time, { hero, coarse, foreground, motion });
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
                if (['rain', 'sunny', 'night'].includes(document.documentElement.dataset.colorTheme)) {
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
            // Scene themes use natural skies instead of geometric decorations.
            if (['rain', 'sunny', 'night'].includes(document.documentElement.dataset.colorTheme)) { ripples.length = 0; return; }
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

        function canAnimate() { return !destroyed && !suspended && !document.hidden && visible && !reduced.matches && (variant !== 'weather' || ['rain', 'sunny', 'night'].includes(document.documentElement.dataset.colorTheme)); }
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
                rainFields.delete(ctx); stormFields.delete(ctx); sunnyFields.delete(ctx); nightFields.delete(ctx);
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
