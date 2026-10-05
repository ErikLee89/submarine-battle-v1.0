/* Windows/MFC services for the original V1.0 machine functions. */
'use strict';
class ShipBridge {
 constructor(cpu,canvas,images){this.cpu=cpu;this.canvas=canvas;this.images=images;this.game=0x500000;this.objects=new Map();this.nextHandle=100;this.wrappers=new Map();this.masked=new Map();this.decoder=new TextDecoder('gb18030');this.clock=1000;this.stats={frames:0,draws:0};this.audio=null;this.buffers=new Map();this.voices=new Map();this.setup();}
 handle(o){const h=this.nextHandle++;this.objects.set(h,o);return h;}
 surface(w,h){const cv=document.createElement('canvas');cv.width=w;cv.height=h;return cv;}
 dc(h){const o=this.objects.get(h);if(!o)throw Error('Missing GDI handle '+h);return o;}
 context(h){return this.dc(h).ctx;}
 bytes(a){let e=a;while(this.cpu.memory[e]&&e-a<65536)e++;return this.cpu.memory.slice(a,e);}
 str(a){return this.decoder.decode(this.bytes(a));}
 nameBytes(name=this.playerName||'Player'){const out=[];for(const char of name){let bytes;if(char.charCodeAt(0)<128)bytes=[char.charCodeAt(0)];else{if(!this.nameMap){this.nameMap=new Map();for(let a=0x81;a<=0xfe;a++)for(let b=0x40;b<=0xfe;b++){if(b===0x7f)continue;const pair=new Uint8Array([a,b]),text=this.decoder.decode(pair);if(text.length===1&&!this.nameMap.has(text))this.nameMap.set(text,[a,b]);}}bytes=this.nameMap.get(char)||[63];}if(out.length+bytes.length>12)break;out.push(...bytes);}return new Uint8Array(out);}
 string(bytes){const p=this.cpu.alloc(bytes.length+16)+12;this.cpu.write(p-12,1);this.cpu.write(p-8,bytes.length);this.cpu.write(p-4,bytes.length);this.cpu.memory.set(bytes,p);return p;}
 assign(obj,bytes){const c=this.cpu,old=c.read(obj);c.write(obj,this.string(bytes));if(old>=0x60000c)c.free(old-12);return obj;}
 color(v){return `rgb(${v&255},${(v>>>8)&255},${(v>>>16)&255})`;}
 bitmap(id){const im=this.images[String(id)];if(!im)throw Error('Missing bitmap '+id);return this.handle({id:String(id),image:im,width:im.width,height:im.height});}
 wrap(h){if(!this.wrappers.has(h)){const p=this.cpu.alloc(8);this.cpu.write(p+4,h);this.wrappers.set(h,p);}return this.wrappers.get(h);}
 select(h,object){const dc=this.dc(h),o=this.objects.get(object),old=dc.selected||0;dc.selected=object;if(o?.image){if(o.image.getContext){dc.canvas=o.image;dc.ctx=o.image.getContext('2d');}else{const cv=this.surface(o.width,o.height);dc.ctx=cv.getContext('2d');dc.ctx.drawImage(o.image,0,0);dc.canvas=cv;}}if(o?.font)dc.font=o.font;if(o?.pen)dc.pen=o.pen;if(o?.brush)dc.brush=o.brush;return old;}
 hook(pc,n,fn){this.cpu.hooks.set(pc,c=>{const v=fn(c);c.ret(n,v===undefined?1:v);});}
 setup(){
  const c=this.cpu,G=this.game,hook=(pc,n,fn)=>this.hook(pc,n,fn),nop=(pc,n=0,v=1)=>hook(pc,n,()=>v);
  nop(0x406940,4);nop(0x417a1a);this.sound=true;this.messages=[];
  this.screen=this.handle({canvas:this.canvas,ctx:this.canvas.getContext('2d'),textColor:'#000',font:'14px SimSun,serif'});
  this.vtable=c.alloc(256);c.write(this.vtable+4,0x720010);c.write(this.vtable+0x5c,0x720000);c.write(this.vtable+0x30,0x720020);c.write(this.vtable+0x24,0x720030);
  hook(0x720020,4,c=>{this.dc(c.read(c.r[1]+4)).textColor=this.color(c.arg(0));return 0;});hook(0x720030,4,()=>this.wrap(0));
  hook(0x720000,16,c=>{this.drawText(c.read(c.r[1]+4),c.arg(0)|0,c.arg(1)|0,c.arg(2),c.arg(3));return 1;});nop(0x720010,4);
  this.profile=JSON.parse(localStorage.getItem('ship10-profile')||'{}');
  hook(0x4113fc,8,c=>{c.write(c.r[1]+0x58,c.arg(0));return c.r[1];});nop(0x4119ae);
  c.hooks.set(0x4114b1,c=>{if(c.read(c.r[1]+0x58)===143){this.pendingName={dialog:c.r[1]};c.suspended=true;return;}c.ret(0,2);});
  hook(0x4109aa,0,c=>{c.write(c.arg(0),Math.floor(Date.now()/1000));return c.arg(0);});hook(0x4109bd,4,()=>{const d=new Date(),p=0x513000;[d.getDate(),d.getMonth(),d.getFullYear()-1900].forEach((v,i)=>c.write(p+12+i*4,v));return p;});
  hook(0x417791,12,c=>{this.profile[this.str(c.arg(0))+':'+this.str(c.arg(1))]=this.str(c.arg(2));localStorage.setItem('ship10-profile',JSON.stringify(this.profile));return 1;});
  hook(0x41771c,12,c=>{this.profile[this.str(c.arg(0))+':'+this.str(c.arg(1))]=c.arg(2);localStorage.setItem('ship10-profile',JSON.stringify(this.profile));return 1;});
  c.write(0x510000+12,1);hook(0x41a9d3,0,()=>0x510000);hook(0x41a583,12,c=>this.profile[this.str(c.arg(0))+':'+this.str(c.arg(1))]??c.arg(2));
  hook(0x41a5ef,16,c=>{c.write(c.arg(0),this.string(this.nameBytes(this.profile[this.str(c.arg(1))+':'+this.str(c.arg(2))]||'')));return c.arg(0);});
  hook(0x41521b,0,c=>c.alloc(c.arg(0)));hook(0x415244,0,c=>{c.free(c.arg(0));return 0;});hook(0x4094f0,0,c=>{c.free(c.arg(0));return 0;});
  hook(0x40ba73,0,()=>0x512000);c.write(0x512014,1);Object.defineProperty(c,'seed',{get:()=>c.read(0x512014),set:v=>c.write(0x512014,v)});hook(0x4096d6,0,()=>Math.floor(Date.now()/1000));
  hook(0x409950,0,c=>{c.memory.fill(c.arg(1)&255,c.arg(0),c.arg(0)+c.arg(2));return c.arg(0);});
  for(const pc of [0x414f7b,0x41504a,0x41510e])hook(pc,4,c=>this.assign(c.r[1],this.bytes(c.arg(0))));
  for(const pc of [0x414cc6,0x414ffa])hook(pc,4,c=>this.assign(c.r[1],this.bytes(c.read(c.arg(0)))));hook(0x414f51,0,c=>{const p=c.read(c.r[1]);if(p>=0x60000c)c.free(p-12);return 0;});
  hook(0x410997,0,c=>{this.assign(c.arg(0),this.format(c));return 0;});
  hook(0x410afc,0,c=>{c.write(c.r[1]+4,0);return c.r[1];});hook(0x410b8e,20,c=>{c.write(c.r[1]+4,this.handle({w:c.arg(0),h:c.arg(1),frames:[]}));return 1;});
  hook(0x416479,0,c=>{c.write(c.r[1],this.vtable);return c.r[1];});hook(0x416530,4,c=>{c.write(c.r[1]+4,c.arg(0));return 1;});
  hook(0x416a98,4,c=>{c.write(c.r[1],this.vtable);c.write(c.r[1]+4,this.screen);return c.r[1];});
  for(const pc of [0x416c8c,0x410bb6])hook(pc,4,c=>{c.write(c.r[1]+4,c.arg(0));return 1;});
  for(const pc of [0x416ce3,0x416598,0x4162b7,0x416b0a,0x416bbe,0x411184])nop(pc);
  hook(0x416671,8,c=>this.wrap(this.select(c.arg(0),c.arg(1))));hook(0x4166c4,4,c=>this.wrap(this.select(c.read(c.r[1]+4),c.arg(0)?c.read(c.arg(0)+4):0)));
  hook(0x41670a,4,c=>{this.dc(c.read(c.r[1]+4)).textColor=this.color(c.arg(0));return 0;});
  for(const pc of [0x416739,0x416767,0x4167c4])nop(pc,4);
  hook(0x416a63,4,c=>{this.dc(c.read(c.r[1]+4)).align=c.arg(0);return 0;});hook(0x416cf9,12,c=>{c.write(c.r[1]+4,this.handle({pen:{color:this.color(c.arg(2)),width:c.arg(1)||1}}));return 1;});
  hook(0x41688a,12,c=>{this.dc(c.read(c.r[1]+4)).point=[c.arg(1)|0,c.arg(2)|0];return c.arg(0);});
  hook(0x4175e3,12,c=>{this.notice=this.str(c.arg(0));return 1;});nop(0x41761b,12);
  nop(0x414644,12);nop(0x4146eb,4);nop(0x418425,16);nop(0x418902,8);nop(0x411d1c);
  const api={
   MoveToEx:[16,c=>{this.dc(c.arg(0)).point=[c.arg(1)|0,c.arg(2)|0];return 1;}],
   ClientToScreen:[8,()=>1],SetCursorPos:[8,()=>1],GetCursorPos:[4,c=>{c.write(c.arg(0),c.read(G+0x180));c.write(c.arg(0)+4,50);return 1;}],ScreenToClient:[8,()=>1],
   PlaySoundA:[12,c=>{this.play(c.arg(0),0,!!(c.arg(2)&8));return 1;}],SetTimer:[16,()=>1],
   LoadBitmapA:[8,c=>this.bitmap(c.arg(1))],
   ImageList_AddMasked:[12,c=>{const list=this.dc(c.arg(0)),bmp=this.dc(c.arg(1)),col=c.arg(2),key=bmp.id+':'+col;let source=this.masked.get(key);if(!source){source=this.surface(bmp.width,bmp.height);const ctx=source.getContext('2d');ctx.drawImage(bmp.image,0,0);const pixels=ctx.getImageData(0,0,bmp.width,bmp.height);for(let i=0;i<pixels.data.length;i+=4)if(pixels.data[i]===(col&255)&&pixels.data[i+1]===((col>>>8)&255)&&pixels.data[i+2]===((col>>>16)&255))pixels.data[i+3]=0;ctx.putImageData(pixels,0,0);this.masked.set(key,source);}const start=list.frames.length;for(let x=0;x+list.w<=bmp.width;x+=list.w)list.frames.push({source,x});return start;}],
   ImageList_Draw:[24,c=>{const list=this.dc(c.arg(0)),f=list.frames[c.arg(1)];if(!f)return 0;this.context(c.arg(2)).drawImage(f.source,f.x,0,list.w,list.h,c.arg(3)|0,c.arg(4)|0,list.w,list.h);this.stats.draws++;return 1;}],
   CreateCompatibleDC:[4,()=>{const cv=this.surface(500,350);return this.handle({canvas:cv,ctx:cv.getContext('2d'),textColor:'#000',font:'14px SimSun,serif'});}],
   CreateCompatibleBitmap:[12,c=>{const cv=this.surface(c.arg(1),c.arg(2));return this.handle({image:cv,width:cv.width,height:cv.height});}],
   SelectObject:[8,c=>this.select(c.arg(0),c.arg(1))],DeleteObject:[4,()=>1],SetBkMode:[8,()=>1],
   SetTextColor:[8,c=>{this.dc(c.arg(0)).textColor=this.color(c.arg(1));return 0;}],SetTextAlign:[8,c=>{this.dc(c.arg(0)).align=c.arg(1);return 0;}],
   BitBlt:[36,c=>{const dc=this.dc(c.arg(5));this.context(c.arg(0)).drawImage(dc.canvas,c.arg(6),c.arg(7),c.arg(3),c.arg(4),c.arg(1),c.arg(2),c.arg(3),c.arg(4));return 1;}],
   StretchBlt:[44,c=>{this.context(c.arg(0)).drawImage(this.dc(c.arg(5)).canvas,c.arg(6),c.arg(7),c.arg(8),c.arg(9),c.arg(1),c.arg(2),c.arg(3),c.arg(4));return 1;}],
   SetPixel:[16,c=>{const ctx=this.context(c.arg(0));ctx.fillStyle=this.color(c.arg(3));ctx.fillRect(c.arg(1),c.arg(2),1,1);return c.arg(3);}],LineTo:[12,c=>{this.line(c.arg(0),c.arg(1)|0,c.arg(2)|0);return 1;}],
   GetTickCount:[0,()=>this.clock],GetClientRect:[8,c=>{[0,0,500,350].forEach((v,i)=>c.write(c.arg(1)+i*4,v));return 1;}],GetSystemMetrics:[4,c=>c.arg(0)===0?500:350],
   GetVersionExA:[4,()=>1],CopyRect:[8,c=>{c.memory.copyWithin(c.arg(0),c.arg(1),c.arg(1)+16);return 1;}],
   IntersectRect:[12,c=>{const [out,a,b]=[c.arg(0),c.arg(1),c.arg(2)],r=[Math.max(c.read(a)|0,c.read(b)|0),Math.max(c.read(a+4)|0,c.read(b+4)|0),Math.min(c.read(a+8)|0,c.read(b+8)|0),Math.min(c.read(a+12)|0,c.read(b+12)|0)],ok=r[2]>r[0]&&r[3]>r[1];r.forEach((v,i)=>c.write(out+i*4,ok?v:0));return +ok;}],
   lstrlenA:[4,c=>this.bytes(c.arg(0)).length],lstrcpyA:[8,c=>{const b=this.bytes(c.arg(1));c.memory.set(b,c.arg(0));c.write(c.arg(0)+b.length,0,1);return c.arg(0);}],wsprintfA:[0,c=>{const b=this.format(c);c.memory.set(b,c.arg(0));c.write(c.arg(0)+b.length,0,1);return b.length;}],
   GetSysColor:[4,()=>0xc8d0d4],GetWindowLongA:[8,()=>1],SetWindowLongA:[12,()=>1],DrawMenuBar:[4,()=>1],KillTimer:[8,()=>1],UpdateWindow:[4,()=>1],
   PostMessageA:[16,c=>{this.messages.push([c.arg(1),c.arg(2),c.arg(3)]);return 1;}],SendMessageA:[16,()=>1],GetStockObject:[4,()=>this.handle({font:'14px SimSun,serif'})]
  };
  this.messages=[];
  SHIP_MACHINE.imports.forEach(([iat,name],i)=>{const address=0x700000+i*16;c.write(iat,address);if(api[name])hook(address,...api[name]);else c.hooks.set(address,()=>{throw Error('Unimplemented service '+name+' from '+c.read(c.r[4]).toString(16));});});
 } line(h,x,y){const dc=this.dc(h),ctx=dc.ctx;ctx.strokeStyle=dc.pen?.color||'#000';ctx.lineWidth=dc.pen?.width||1;const [px,py]=dc.point||[0,0],width=dc.pen?.width||1;ctx.fillStyle=ctx.strokeStyle;if(py===y)ctx.fillRect(Math.min(px,x),y-Math.floor(width/2),Math.abs(x-px),width);else if(px===x)ctx.fillRect(x-Math.floor(width/2),Math.min(py,y),width,Math.abs(y-py));else{ctx.beginPath();ctx.moveTo(px+.5,py+.5);ctx.lineTo(x+.5,y+.5);ctx.stroke();}dc.point=[x,y];}
 drawText(h,x,y,p,n){const dc=this.dc(h),ctx=dc.ctx;ctx.font=dc.font||'14px SimSun,serif';ctx.fillStyle=dc.textColor||'#000';ctx.textBaseline='top';ctx.textAlign=(dc.align&6)===6?'center':(dc.align&2)?'right':'left';ctx.fillText(this.decoder.decode(this.cpu.memory.slice(p,p+n)),x,y);}
 format(c){const fmt=this.bytes(c.arg(1)),out=[];let arg=2;for(let i=0;i<fmt.length;i++){if(fmt[i]!==37){out.push(fmt[i]);continue;}let j=i+1;while(j<fmt.length&&!['d','u','s','x','X','c','%'].includes(String.fromCharCode(fmt[j])))j++;const type=String.fromCharCode(fmt[j]);if(type==='%'){out.push(37);i=j;continue;}const v=c.arg(arg++),spec=String.fromCharCode(...fmt.slice(i+1,j)),width=+(spec.match(/\.(\d+)/)?.[1]||spec.match(/^(\d+)/)?.[1]||0);let bytes;if(type==='s')bytes=this.bytes(v);else{let str=type==='d'?String(v|0):type==='x'||type==='X'?v.toString(16):type==='c'?String.fromCharCode(v&255):String(v);if(type==='X')str=str.toUpperCase();str=str.padStart(width,spec.includes('.')||spec.startsWith('0')?'0':' ');if(this.savingCustom&&width&&(type==='x'||type==='X'))str=str.slice(-width);bytes=new TextEncoder().encode(str);}out.push(...bytes);i=j;}return new Uint8Array(out);}
 startLevel(level){this.cpu.write(this.game+0x1c8,level-1);this.keyDown(113);}
 mouse(x,y,click=false){if(!this.useMouse)return;this.cpu.run(0x4072f0,this.game,[0,Math.round(x),Math.round(y)]);if(click)this.tuning.fire(()=>this.cpu.run(0x402f20,this.game,[0,Math.round(x),Math.round(y)]));}
 end(){this.cpu.run(0x407520,this.game);this.cpu.run(0x407330,this.game,[0,0]);}
 persistScores(){const c=this.cpu,base=c.read(this.game+0x14c);for(let i=0;i<10;i++){const a=base+i*40;this.profile['Top10Players:Name'+i]=this.str(a+4);this.profile['Top10Players:Stage'+i]=c.read(a+20);this.profile['Top10Players:Points'+i]=c.read(a+24);this.profile['Top10Players:Date'+i]=this.str(a+28);}localStorage.setItem('ship10-profile',JSON.stringify(this.profile));}
 completeName(name){const pending=this.pendingName;if(!pending)return;const c=this.cpu;this.pendingName=null;if(name!==null){this.playerName=name;this.assign(pending.dialog+0x5c,this.nameBytes(name));}c.suspended=false;c.ret(0,name===null?2:1);c.resume();this.persistScores();this.showScores=name!==null;}
 initialize(){const c=this.cpu;c.run(0x401870,this.game);c.write(this.game+0x1c,1);c.run(0x402420,this.game,[0]);c.run(0x4066d0,this.game);this.step=35;this.tuning=new ShipTuning(this);this.frame();}
 frame(){if(this.cpu.suspended)return;this.tuning.beforeFrame();this.clock+=this.step||35;this.cpu.run(0x403050,this.game,[0x451]);this.stats.frames++;while(this.messages.length){const [msg,a,b]=this.messages.shift();if(msg===0x111){const fn={0x8000:0x4066d0,0x8001:0x4068b0,0x8002:0x407520}[a];if(fn)this.cpu.run(fn,this.game);}else if(msg===0x7001)this.cpu.run(0x407330,this.game,[a,b]);}}
 keyDown(vk){if(vk===113)this.cpu.run(0x4066d0,this.game);else if(vk===114)this.cpu.run(0x4068b0,this.game);else {const run=()=>this.cpu.run(0x406ec0,this.game,[vk,1,0]);if([32,90,88].includes(vk))this.tuning.fire(run);else run();}}
 keyUp(vk){this.cpu.run(0x4072c0,this.game,[vk,1,0]);}
 state(){const c=this.cpu,G=this.game;return {level:c.read(G+0x154)+1,score:c.read(G+0x190),x:c.read(G+0x180),y:c.read(G+0x184),bombs:c.read(G+0x168),lives:c.read(G+0x178),paused:c.read(G+0x150)===1,player:!!c.read(G+0x188),step:this.step,capacity:this.tuning.config.enabled?this.tuning.config.bombLimit:5,nukes:0,progress:Math.min(99,Math.floor(c.read(G+0x158)*100/((c.read(G+0x154)+6)*5)))};}
 stopAudio(){for(const voice of this.voices.values())try{voice.stop();}catch{}this.voices.clear();}
 async audioReady(){if(!this.audio){this.audio=new AudioContext();this.audioLoading=Promise.all(Object.entries(SHIP_AUDIO).map(async([id,b64])=>{const raw=Uint8Array.from(atob(b64),x=>x.charCodeAt(0));this.buffers.set(+id,await this.audio.decodeAudioData(raw.buffer));}));}await this.audio.resume();await this.audioLoading;}
 play(id,slot,loop=false){if(!this.sound||!this.audio||!this.buffers.has(id))return;const old=this.voices.get(slot);if(old)try{old.stop();}catch{}const src=this.audio.createBufferSource();src.buffer=this.buffers.get(id);src.loop=loop;src.connect(this.audio.destination);this.voices.set(slot,src);src.onended=()=>{if(this.voices.get(slot)===src)this.voices.delete(slot);};src.start();}
}
window.ShipBridge=ShipBridge;
