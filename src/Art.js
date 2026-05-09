export const OUTLINE = "#47321f";
export const SOFT_OUTLINE = "rgba(57,39,25,.72)";

export function fillStroke(ctx, fill, stroke = OUTLINE, line = 3){
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = line;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.lineWidth = 1;
}

export function ellipse(ctx, x, y, rx, ry, rot, fill, stroke = OUTLINE, line = 3){
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  fillStroke(ctx, fill, stroke, line);
}

export function roundedRect(ctx, x, y, w, h, r, fill, stroke = OUTLINE, line = 2){
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  fillStroke(ctx, fill, stroke, line);
}

export function contactShadow(ctx, x, y, w, alpha = 0.18){
  ctx.save();
  ctx.fillStyle = `rgba(28,20,13,${alpha})`;
  ctx.beginPath();
  ctx.ellipse(x, y, w, Math.max(4, w * 0.16), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function shine(ctx, x, y, w, h, alpha = 0.24){
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, `rgba(255,255,255,${alpha})`);
  g.addColorStop(0.45, "rgba(255,255,255,.06)");
  g.addColorStop(1, "rgba(0,0,0,.08)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function drawGrassClump(ctx, x, y, wind = 0, scale = 1, color = "#3d9952"){
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  for (let i = -3; i <= 3; i++){
    const h = (10 + (i % 3) * 3) * scale;
    const sway = Math.sin(wind + i) * 5 * scale;
    ctx.beginPath();
    ctx.moveTo(x + i * 4 * scale, y);
    ctx.quadraticCurveTo(x + i * 3 * scale + sway, y - h * 0.55, x + i * 5 * scale + sway, y - h);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawFlower(ctx, x, y, color = "#ffdf6f", wind = 0){
  ctx.save();
  ctx.strokeStyle = "#3f8b43";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + Math.sin(wind) * 3, y - 9, x + Math.sin(wind) * 5, y - 17);
  ctx.stroke();
  ctx.translate(x + Math.sin(wind) * 5, y - 18);
  ctx.fillStyle = color;
  for (let i = 0; i < 5; i++){
    ctx.rotate((Math.PI * 2) / 5);
    ctx.beginPath();
    ctx.ellipse(0, -4, 3, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#f8a93a";
  ctx.beginPath();
  ctx.arc(0, 0, 2.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawWoodGrain(ctx, x, y, w, h, alpha = 0.28){
  ctx.save();
  ctx.strokeStyle = `rgba(72,39,19,${alpha})`;
  ctx.lineWidth = 1.3;
  for (let i = 6; i < w; i += 12){
    ctx.beginPath();
    ctx.moveTo(x + i, y + 4);
    ctx.bezierCurveTo(x + i - 3, y + h * 0.35, x + i + 4, y + h * 0.65, x + i, y + h - 4);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawSoftLight(ctx, x, y, r, color = "255,218,132", alpha = 0.18){
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${color},${alpha})`);
  g.addColorStop(0.55, `rgba(${color},${alpha * 0.34})`);
  g.addColorStop(1, `rgba(${color},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

export function drawPlankSign(ctx, x, y, text = ""){
  roundedRect(ctx, x - 40, y - 30, 80, 34, 7, "#b98148", OUTLINE, 2.4);
  drawWoodGrain(ctx, x - 38, y - 28, 76, 30);
  roundedRect(ctx, x - 5, y + 1, 10, 58, 4, "#7a563a", OUTLINE, 2);
  if (text){
    ctx.fillStyle = "#fff1cc";
    ctx.font = "bold 11px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(text, x, y - 10);
    ctx.textAlign = "start";
  }
}
