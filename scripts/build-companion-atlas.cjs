// Read alpha bounds only; original image pixels are never changed.
// Rebuild atlas view windows after replacing generated art. RAIN_SHARP may locate sharp.
const sharp=require(process.env.RAIN_SHARP||'sharp'),fs=require('node:fs'),path=require('node:path');
const base=path.join(__dirname,'../critter-cascade/assets/companions');
const grids={cats:[[0,247,511,778,1062,1402],[0,284,574,865,1122]],dragons:[[0,244,506,779,1057,1402],[0,299,566,837,1122]],birds:[[0,249,511,782,1060,1402],[0,346,625,884,1122]],shells:[[0,254,515,799,1070,1402],[0,305,571,841,1122]]};
(async()=>{const atlas={};for(const [family,[xs,ys]] of Object.entries(grids)){
 const {data,info}=await sharp(path.join(base,family+'.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 atlas[family]=[];
 for(let row=0;row<4;row++) { const boxes=[];for(let col=0;col<5;col++){
  const x0=xs[col],y0=ys[row],w=xs[col+1]-x0,h=ys[row+1]-y0,seen=new Uint8Array(w*h);let best=null;
  const opaque=(x,y)=>data[((y0+y)*info.width+x0+x)*4+3]>=96;
  for(let start=0;start<w*h;start++){
   const sx=start%w,sy=Math.floor(start/w);if(seen[start]||!opaque(sx,sy))continue;
   seen[start]=1;const queue=[start];let minX=sx,maxX=sx,minY=sy,maxY=sy;
   for(let head=0;head<queue.length;head++) {const q=queue[head],x=q%w,y=Math.floor(q/w);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
    for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,1],[-1,1],[1,-1]]){const nx=x+dx,ny=y+dy,n=ny*w+nx;if(nx<0||nx>=w||ny<0||ny>=h||seen[n]||!opaque(nx,ny))continue;seen[n]=1;queue.push(n);}
   }
   if(!best||queue.length>best.size)best={size:queue.length,minX,maxX,minY,maxY};
  }
  if(!best)throw Error('Empty sprite '+family+row+col);
  const x=Math.max(x0,x0+best.minX-2),y=Math.max(y0,y0+best.minY-2);
  if (family==='cats' && row===0 && col===4) best.maxY=Math.min(best.maxY,267); // Exclude a neighboring mane at the atlas row seam.
  boxes.push([x,y,Math.min(xs[col+1],x0+best.maxX+3)-x,Math.min(ys[row+1],y0+best.maxY+3)-y]);
 }atlas[family].push(boxes);}
}
fs.writeFileSync(path.join(base,'atlas.js'),'/* Alpha-derived sprite view windows. Source pixels remain unchanged. */\n(function(root){const atlas='+JSON.stringify(atlas)+'; if(typeof module!=="undefined"&&module.exports)module.exports=atlas;else root.ClackAtlas=atlas;})(globalThis);\n');console.log('Indexed 80 animal sprite bounds.');})().catch(e=>{console.error(e);process.exit(1)});
