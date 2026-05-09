export const MATERIALS = {
  wood: { base:"#9b6a42", shade:"#5b321e", hi:"#d6a166" },
  hay: { base:"#d9b84b", shade:"#8c6820", hi:"#ffe27a" },
  stone: { base:"#8c94a2", shade:"#4f5661", hi:"#c8ced8" },
  cloth: { base:"#9fc5d9", shade:"#42677a", hi:"#d7f1ff" },
  ghost: { base:"rgba(210,235,255,.42)", shade:"rgba(100,150,190,.18)", hi:"rgba(255,255,255,.66)" }
};

export class RenderLayers {
  constructor(ctx){
    this.ctx = ctx;
    this.names = ["background","world","shadows","actors","vfx","ui"];
  }

  drawLayer(name, fn){
    if (!this.names.includes(name)) return fn(this.ctx);
    this.ctx.save();
    fn(this.ctx);
    this.ctx.restore();
  }
}

export class SpriteAtlas {
  constructor(){
    this.icons = new Map([
      ["fireball", { fill:"#ff7a2a", stroke:"#69220e", glyph:"F" }],
      ["ice", { fill:"#b7f5ff", stroke:"#267a9d", glyph:"I" }],
      ["lightning", { fill:"#fff26a", stroke:"#8b6a00", glyph:"B" }],
      ["eggBomb", { fill:"#fff2d2", stroke:"#8f5b1d", glyph:"E" }],
      ["shield", { fill:"#98d9ff", stroke:"#2d6685", glyph:"S" }],
      ["heal", { fill:"#9cffaa", stroke:"#2c7a3e", glyph:"+" }],
      ["life", { fill:"#ffd1e5", stroke:"#9a3158", glyph:"♥" }],
      ["upgrade", { fill:"#ffd76a", stroke:"#8f6420", glyph:"↑" }]
    ]);
  }

  drawIcon(ctx, id, x, y, size=34){
    const icon = this.icons.get(id) || this.icons.get("upgrade");
    ctx.save();
    ctx.fillStyle = icon.fill;
    ctx.strokeStyle = icon.stroke;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect?.(x, y, size, size, 9);
    if (!ctx.roundRect){
      ctx.rect(x, y, size, size);
    }
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,.30)";
    ctx.beginPath();
    ctx.ellipse(x+size*.38, y+size*.28, size*.20, size*.10, -0.35, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = "#1a130d";
    ctx.font = `bold ${Math.floor(size*.48)}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(icon.glyph, x+size/2, y+size/2+1);
    ctx.restore();
  }
}

export const atlas = new SpriteAtlas();
