import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { palette } from '../core/materials.js';
import { mesh, block, signPanel, FONT, roundRect } from '../core/build.js';

/** Profil latéral d'une voiture de tête (nez profilé), dans le plan x,y. */
function headProfile(len, h, nose) {
  const s = new THREE.Shape();
  s.moveTo(-len / 2, 0.45);
  s.lineTo(len / 2 - nose * 0.55, 0.45);
  s.quadraticCurveTo(len / 2, 0.5, len / 2, 1.3);
  s.lineTo(len / 2 - nose * 0.15, 2.4);
  s.quadraticCurveTo(len / 2 - nose * 0.5, h, len / 2 - nose, h);
  s.lineTo(-len / 2, h);
  s.closePath();
  return s;
}

/**
 * Rame régionale stylisée, orientée selon +x (le nez en x = 0, rame vers -x).
 * Retourne { object, length, doors: [{x, car}] }
 */
export function makeTrain({ cars = 3, carLen = 22, accent = true, scale = 1, carNumbers = true } = {}) {
  const grp = new THREE.Group();
  const w = 2.9, h = 4.0, gap = 0.6;
  const bodyMat = palette.get('vehicle', { roughness: 0.55 });
  const winMat = palette.get('facade3', { roughness: 0.3 });
  const stripeMat = accent ? palette.accent('accent', { glow: 0.3 }) : palette.get('detail');
  const doors = [];
  for (let i = 0; i < cars; i++) {
    const cx = -carLen / 2 - i * (carLen + gap);
    const isHead = i === 0, isTail = i === cars - 1;
    let g;
    if (isHead || isTail) {
      g = new THREE.ExtrudeGeometry(headProfile(carLen, h, 4.2), { depth: w, bevelEnabled: true, bevelSize: 0.12, bevelThickness: 0.12, bevelSegments: 2, curveSegments: 10 });
      g.translate(0, 0, -w / 2);
      if (isTail && !isHead) g.rotateY(Math.PI);
    } else {
      g = new RoundedBoxGeometry(carLen, h - 0.45, w, 3, 0.35);
      g.translate(0, (h + 0.45) / 2, 0);
    }
    g.translate(cx, 0, 0);
    grp.add(mesh(g, bodyMat, { edgeAngle: 40, edgeOpacity: 0.5 }));
    // bandeau vitré
    const wl = carLen - (isHead || isTail ? 6 : 2);
    const wx = cx + (isHead ? -2 : isTail ? 2 : 0);
    grp.add(block(wx - wl / 2, 2.15, -w / 2 - 0.13, wx + wl / 2, 3.15, w / 2 + 0.13, winMat, { edges: false, cast: false }));
    // liseré
    grp.add(block(cx - carLen / 2 + 0.3, 0.95, -w / 2 - 0.14, cx + carLen / 2 - 0.3, 1.2, w / 2 + 0.14, stripeMat, { edges: false, cast: false }));
    // bogies
    for (const bx of [cx - carLen / 2 + 3, cx + carLen / 2 - 3]) grp.add(block(bx - 1.4, 0, -1.1, bx + 1.4, 0.55, 1.1, 'rail', { edges: false }));
    // portes (côté +z et -z)
    for (const dxp of [-carLen * 0.28, carLen * 0.28]) {
      const dx = cx + dxp;
      doors.push({ x: dx, car: i + 1 });
      grp.add(block(dx - 0.65, 0.6, -w / 2 - 0.15, dx + 0.65, 3.0, w / 2 + 0.15, 'facade2', { edges: false, cast: false }));
    }
    if (carNumbers) {
      const num = signPanel({ w: 1.0, h: 1.0, key: 'carnum' + (i + 1) + accent, draw: (ctx, W, H) => {
        ctx.fillStyle = accent ? '#12b3e6' : '#9aa5b1';
        ctx.beginPath(); ctx.arc(W / 2, H / 2, W * 0.48, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = `700 ${Math.round(H * 0.62)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), W / 2, H / 2 + H * 0.04);
      } });
      num.position.set(cx + carLen * 0.05, 2.65, w / 2 + 0.17);
      grp.add(num);
      const num2 = num.clone();
      num2.position.z = -w / 2 - 0.17;
      num2.rotation.y = Math.PI;
      grp.add(num2);
    }
  }
  // pantographe stylisé sur la voiture de tête
  grp.add(block(-carLen * 0.6 - 1.5, h, -0.6, -carLen * 0.6 + 1.5, h + 0.25, 0.6, 'detail', { edges: false }));
  const length = cars * carLen + (cars - 1) * gap;
  grp.scale.setScalar(scale);
  grp.userData.length = length * scale;
  return { object: grp, length: length * scale, doors: doors.map((d) => ({ x: d.x * scale, car: d.car })), width: w * scale };
}

/** Bus urbain stylisé, orienté selon +x (avant en +x). */
export function makeBus({ line = '18', direction = '' } = {}) {
  const grp = new THREE.Group();
  const L = 12, W = 2.55, H = 3.1;
  const g = new RoundedBoxGeometry(L, H - 0.35, W, 3, 0.32);
  g.translate(0, (H + 0.35) / 2, 0);
  grp.add(mesh(g, palette.get('vehicle', { roughness: 0.5 }), { edgeAngle: 40, edgeOpacity: 0.5 }));
  grp.add(block(-L / 2 + 0.6, 1.5, -W / 2 - 0.06, L / 2 - 0.4, 2.85, W / 2 + 0.06, palette.get('facade3', { roughness: 0.3 }), { edges: false, cast: false }));
  grp.add(block(L / 2 - 0.2, 1.1, -W / 2 + 0.15, L / 2 + 0.06, 2.9, W / 2 - 0.15, palette.get('facade3', { roughness: 0.3 }), { edges: false, cast: false }));
  grp.add(block(-L / 2 + 0.2, 0.75, -W / 2 - 0.07, L / 2 - 0.2, 0.98, W / 2 + 0.07, palette.accent('accent', { glow: 0.3 }), { edges: false, cast: false }));
  for (const wx of [-L / 2 + 2.6, L / 2 - 2.4]) {
    for (const wz of [-W / 2, W / 2]) {
      const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.3, 18), palette.get('dark'));
      wh.rotation.x = Math.PI / 2; wh.position.set(wx, 0.5, wz); grp.add(wh);
    }
  }
  // girouette (numéro de ligne)
  const sign = signPanel({ w: 2.2, h: 0.45, key: 'bus' + line + direction, draw: (ctx, W2, H2) => {
    ctx.fillStyle = '#26313c'; ctx.fillRect(0, 0, W2, H2);
    ctx.fillStyle = '#12b3e6'; roundRect(ctx, 6, 6, H2 * 1.4, H2 - 12, 10); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `700 ${Math.round(H2 * 0.6)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(line, 6 + H2 * 0.7, H2 / 2 + 2);
    ctx.fillStyle = '#9fe6fb'; ctx.textAlign = 'left'; ctx.font = `600 ${Math.round(H2 * 0.45)}px ${FONT}`;
    ctx.fillText(direction, H2 * 1.6 + 14, H2 / 2 + 2);
  } });
  sign.rotation.y = Math.PI / 2;
  sign.position.set(L / 2 + 0.08, 2.65, 0);
  grp.add(sign);
  const side = sign.clone(); side.rotation.y = 0; side.position.set(L / 2 - 2.0, 2.65, W / 2 + 0.08); grp.add(side);
  const side2 = sign.clone(); side2.rotation.y = Math.PI; side2.position.set(L / 2 - 2.0, 2.65, -W / 2 - 0.08); grp.add(side2);
  grp.userData.length = L;
  return { object: grp, length: L };
}

/** Voiture particulière stylisée, orientée selon +x. */
export function makeCar({ accent = true } = {}) {
  const grp = new THREE.Group();
  const L = 4.6, W = 1.85;
  const low = new RoundedBoxGeometry(L, 0.75, W, 2, 0.22);
  low.translate(0, 0.35 + 0.375, 0);
  grp.add(mesh(low, palette.get('vehicle', { roughness: 0.45 }), { edgeAngle: 40, edgeOpacity: 0.5 }));
  const cab = new THREE.Shape();
  cab.moveTo(-1.7, 0); cab.lineTo(1.0, 0); cab.lineTo(0.35, 0.62); cab.lineTo(-1.3, 0.62); cab.closePath();
  const cg = new THREE.ExtrudeGeometry(cab, { depth: W - 0.2, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 2 });
  cg.translate(0, 1.08, -(W - 0.2) / 2);
  grp.add(mesh(cg, palette.get('facade3', { roughness: 0.3 }), { edgeAngle: 40, edgeOpacity: 0.5 }));
  for (const wx of [-1.45, 1.45]) for (const wz of [-W / 2 + 0.05, W / 2 - 0.05]) {
    const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 16), palette.get('dark'));
    wh.rotation.x = Math.PI / 2; wh.position.set(wx, 0.34, wz); grp.add(wh);
  }
  if (accent) {
    const lamp = block(-0.45, 1.72, -0.2, 0.15, 1.86, 0.2, palette.accent('accent', { glow: 0.8 }), { edges: false });
    grp.add(lamp);
    grp.add(block(-L / 2 + 0.1, 0.75, -W / 2 - 0.02, L / 2 - 0.1, 0.85, W / 2 + 0.02, palette.accent('accent', { glow: 0.3 }), { edges: false, cast: false }));
  }
  grp.userData.length = L;
  return { object: grp, length: L };
}

/** Pose un véhicule le long d'une polyligne (dist d), orienté selon la tangente. */
export function placeOnRoute(obj, route, d, back = 0) {
  const p = route.posAt(d);
  const ahead = route.posAt(Math.min(route.length, d + 2));
  const behind = route.posAt(Math.max(0, d - 2));
  const dir = ahead.sub(behind);
  if (back) p.addScaledVector(dir.clone().normalize(), -back);
  obj.position.copy(p);
  if (dir.lengthSq() > 1e-6) obj.rotation.y = Math.atan2(-dir.z, dir.x);
}
