/* Optional changes at verified V1.0 instruction boundaries. */
'use strict';
class ShipTuning {
 static defaults={enabled:false,bombLimit:5,lives:5,volley:1,spacing:18,moveSpeed:5,respawnSeconds:0,shieldSeconds:31.5,pickupSeconds:0.385,invincible:false};
 static limits={bombLimit:[1,100,1],lives:[1,999,1],volley:[1,100,1],spacing:[4,80,1],moveSpeed:[1,40,1],respawnSeconds:[0,600,.01],shieldSeconds:[0,600,.01],pickupSeconds:[0,600,.01]};
 static rules(value={}){const r={...this.defaults,...value};for(const [k,[min,max,step]] of Object.entries(this.limits)){if(!Number.isFinite(r[k])||r[k]<min||r[k]>max||(step===1&&!Number.isInteger(r[k])))throw Error('玩法参数超出允许范围');}r.enabled=!!r.enabled;r.invincible=!!r.invincible;return r;}
 constructor(bridge){this.bridge=bridge;this.cpu=bridge.cpu;this.G=bridge.game;this.config={...ShipTuning.defaults};this.hooks=[];this.protectionKind='respawnSeconds';}
 at(pc,after,before){const c=this.cpu,alias=0x740000+this.hooks.length*16;c.code.set(alias,c.code.get(pc));const old=c.hooks.get(pc);c.hooks.set(pc,cpu=>{if(before?.(cpu))return;cpu.pc=alias;cpu.step();after?.(cpu);});this.hooks.push([pc,old,alias]);}
 immediate(pc,value){const c=this.cpu,original=c.code.get(pc);this.at(pc,null,cpu=>{const ins=[...original];ins[3]=original[3].map(o=>[...o]);ins[3][1][2]=value();const alias=this.hooks.find(h=>h[0]===pc)[2];c.code.set(alias,ins);cpu.pc=alias;cpu.step();return true;});}
 clearBombs(){const c=this.cpu;for(let i=0;i<100;i++){c.write(this.bombs+i*56+16,0);c.write(this.flags+i*4,1);}c.write(this.G+0x168,0);}
 protect(kind){this.protectionKind=kind;const c=this.cpu,G=this.G;c.write(G+0x1b0,Math.ceil(this.config[kind]*1000/this.bridge.step));c.write(G+0x1a0,+(this.config.invincible||this.config[kind]>0));c.write(G+0x1c0,+this.config.invincible);}
 newGame(){this.clearBombs();this.cpu.write(this.G+0x178,this.config.lives);this.protect('respawnSeconds');}
 install(){const c=this.cpu,G=this.G;this.at(0x404cf2,cpu=>{cpu.r[2]=this.pickupExpiry;},cpu=>{this.pickupExpiry=cpu.r[2];cpu.r[2]=Math.max(0,this.pickupExpiry-22)+Math.ceil(this.config.pickupSeconds*1000/this.bridge.step)*2;return false;});this.nativeBombs=c.read(G+0x11c);this.nativeFlags=c.read(G+0x198);this.bombs=c.alloc(5600);this.flags=c.alloc(400);c.memory.set(c.memory.slice(this.nativeBombs,this.nativeBombs+280),this.bombs);c.memory.set(c.memory.slice(this.nativeFlags,this.nativeFlags+20),this.flags);for(let i=5;i<100;i++)c.write(this.flags+i*4,1);c.write(G+0x198,this.flags);
  // Enemy ordnance remains in the original shared pool, slots 5 and above.
  for(const pc of [0x402f4b,0x402f9f,0x403609,0x403849,0x403a73,0x4057ba,0x4057d6,0x4057ff,0x407002,0x407054,0x4070dc,0x40712e,0x4071b6,0x40720b])this.at(pc,cpu=>cpu.set(cpu.code.get(pc)[3][0],this.bombs));
  for(const pc of [0x402f2c,0x406ff2,0x4070cc,0x4071a6,0x4057af])this.immediate(pc,()=>this.config.bombLimit);
  for(const pc of [0x403809,0x403a3c,0x403dcf])this.immediate(pc,()=>this.config.bombLimit*56);
  this.at(0x405855,null,cpu=>{const index=cpu.read(cpu.r[4]+0x1c),cap=this.config.bombLimit;if(index>=19&&cap>20){if(index+1<cap){cpu.write(cpu.r[4]+0x1c,index+1);cpu.r[7]=(index+1)*56;cpu.pc=0x4057af;return true;}cpu.write(cpu.r[4]+0x1c,19);}return false;});
  for(const pc of [0x405f8a,0x406cad,0x407588])this.at(pc,()=>this.clearBombs());
  this.at(0x406828,()=>this.newGame());this.at(0x404de2,()=>this.protect('shieldSeconds'));this.at(0x40642c,()=>{if(!this.playerBeforeMessage)this.protect('respawnSeconds');},cpu=>{this.playerBeforeMessage=!!cpu.read(G+0x188);return false;});
  this.at(0x40657a,cpu=>{if((cpu.read(G+0x1b0)|0)<0)cpu.write(G+0x1b0,0);});
  this.immediate(0x4065e1,()=>-this.config.moveSpeed);this.immediate(0x4065f5,()=>this.config.moveSpeed);
 }
 apply(value){const next=ShipTuning.rules(value),old=this.config,c=this.cpu,G=this.G;this.config=next;if(next.enabled&&!old.enabled)this.install();if(!next.enabled&&old.enabled){for(const [pc,previous,alias] of this.hooks){if(previous)c.hooks.set(pc,previous);else c.hooks.delete(pc);c.code.delete(alias);}this.hooks=[];c.write(G+0x198,this.nativeFlags);for(let i=0;i<5;i++)c.write(this.nativeBombs+i*56+16,0);c.free(this.bombs);c.free(this.flags);c.write(G+0x168,0);c.write(G+0x178,5);c.write(G+0x1c0,0);c.write(G+0x1a0,0);c.write(G+0x1b0,0);c.write(G+0x18c,0);}
  if(!next.enabled)return;if(!old.enabled||next.lives!==old.lives)c.write(G+0x178,next.lives);let active=0;for(let i=0;i<100;i++){const a=this.bombs+i*56;if(i>=next.bombLimit)c.write(a+16,0);else active+=+(c.read(a+16)!==0);}c.write(G+0x168,active);if(!old.enabled||next[this.protectionKind]!==old[this.protectionKind])this.protect(this.protectionKind);else{c.write(G+0x1c0,+next.invincible);c.write(G+0x1a0,+(next.invincible||c.read(G+0x1b0)>0));}
 }
 fire(run){if(!this.config.enabled||this.config.volley===1){run();return;}const c=this.cpu,G=this.G,before=c.read(G+0x168),count=Math.min(this.config.volley,this.config.bombLimit-before);if(count<1){run();return;}let first=0;while(first<100&&c.read(this.bombs+first*56+16))first++;run();if(c.read(G+0x168)!==before+1)return;const source=this.bombs+first*56,template=c.memory.slice(source,source+56),spacing=Math.min(this.config.spacing,485/Math.max(1,count-1)),span=(count-1)*spacing,start=Math.max(0,Math.min(485-span,c.read(source+8)-span/2));c.write(source+8,Math.round(start));let added=1;for(let i=0;i<100&&added<count;i++){const a=this.bombs+i*56;if(c.read(a+16))continue;c.memory.set(template,a);c.write(a+8,Math.round(start+added*spacing));c.write(this.flags+i*4,1);added++;}c.write(G+0x168,before+added);}
 rescaleProtection(oldStep,newStep){if(this.config.enabled){const c=this.cpu,base=c.read(this.G+0x124);for(let i=0;i<6;i++){const a=base+i*56,start=Math.max(0,c.read(a+24)-22),elapsed=c.read(a+28)-start;if(c.read(a+16)&&elapsed>0)c.write(a+28,start+Math.round(elapsed*oldStep/newStep));}}if(this.config.enabled)this.cpu.write(this.G+0x1b0,Math.ceil(this.cpu.read(this.G+0x1b0)*oldStep/newStep));}
 beforeFrame(){if(this.config.enabled&&this.config.invincible){this.cpu.write(this.G+0x1a0,1);this.cpu.write(this.G+0x1c0,1);}}
}
window.ShipTuning=ShipTuning;
