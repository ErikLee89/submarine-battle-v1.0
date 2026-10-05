import sys,json
from pathlib import Path
from playwright.sync_api import sync_playwright
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[1]
def boot(browser,width=1440,height=900):
 q=browser.new_page(viewport={'width':width,'height':height});q.goto((root/'index.html').as_uri());q.wait_for_function('window.gameReady');q.evaluate('stopped=true');return q
with sync_playwright() as p:
 b=p.chromium.launch(channel='msedge',headless=True);q=boot(b);results=[]
 result=q.evaluate('''()=>{const rows=[];for(let stage=1;stage<=20;stage++){ship.startLevel(stage);ship.cpu.seed=123456;ship.cpu.write(ship.game+0x1c0,1);ship.cpu.write(ship.game+0x1a0,1);for(let i=0;i<700;i++){if(i%10===0)ship.keyDown(32);ship.frame();}rows.push(ship.state());}ship.cpu.run(0x406c30,ship.game,[0,0]);if(ship.state().level!==1)throw Error('stage loop');return rows;}''')
 results.append({'check':'20 original stages and cycle','states':result});print('PASS 20 stages and cycle')
 q.evaluate('ship.startLevel(1);ship.tuning.apply({enabled:true,bombLimit:100,volley:100,lives:999,moveSpeed:18,respawnSeconds:3,shieldSeconds:7,invincible:true});ship.keyDown(32)')
 assert q.evaluate('ship.state().bombs')==100
 assert q.evaluate('Array.from({length:100},(_,i)=>ship.cpu.read(ship.tuning.bombs+i*56+8)).every(x=>x>=0&&x<=485)')
 before=q.evaluate('ship.cpu.read(ship.tuning.bombs+99*56+12)');q.evaluate('ship.frame()');assert q.evaluate('ship.cpu.read(ship.tuning.bombs+99*56+12)')==before+3
 q.evaluate('for(let i=0;i<140;i++)ship.frame()');assert q.evaluate('ship.state().bombs')==0
 print('PASS 100 bombs move and retire')
 # Force a native collision with the last extension slot, without spawning anything new.
 r=q.evaluate('''()=>{ship.startLevel(1);ship.tuning.clearBombs();const c=ship.cpu,G=ship.game,a=ship.tuning.bombs+99*56,e=c.read(G+0x114);c.memory.fill(0,a,a+56);c.write(a+8,200);c.write(a+12,220);c.write(a+16,1);c.write(G+0x168,1);c.write(e+8,200);c.write(e+12,220);c.write(e+16,1);c.write(e+20,0);c.write(e+24,1);c.write(G+0x158,1);const before=ship.state().score;ship.frame();return {score:ship.state().score-before,enemy:c.read(e+16),bomb:c.read(a+16)};}''')
 assert r['score']==10 and r['enemy']==0 and r['bomb']==0,r;results.append({'check':'slot99 native collision','result':r});print('PASS slot 99 collision and score')
 q.evaluate('ship.startLevel(1);ship.keyDown(39);ship.frame();ship.frame();ship.keyUp(39)');assert q.evaluate('ship.state().x')==218+18
 q.evaluate('ship.tuning.apply({...ship.tuning.config,invincible:false,respawnSeconds:1});ship.startLevel(1)');n=q.evaluate('ship.cpu.read(ship.game+0x1b0)');q.evaluate('ship.keyDown(114);for(let i=0;i<20;i++)ship.frame()');assert q.evaluate('ship.cpu.read(ship.game+0x1b0)')==n
 q.evaluate('ship.keyDown(114);for(let i=0;i<31;i++)ship.frame()');assert not q.evaluate('ship.cpu.read(ship.game+0x1a0)');print('PASS movement and pause/expiry')
 r=q.evaluate('''()=>{ship.tuning.apply({...ship.tuning.config,enabled:false});ship.startLevel(1);const c=ship.cpu,G=ship.game,e=c.read(G+0x114),a=c.read(G+0x124);c.write(e+8,200);c.write(e+12,200);c.write(e+16,1);c.write(e+20,0);c.write(G+0x158,1);c.write(a+8,240);c.write(a+12,45);c.write(a+16,1);c.write(a+24,200);c.write(a+28,0);c.write(a+36,1);ship.frame();return {score:ship.state().score,active:c.read(e+16),pickup:c.read(a+16)};}''')
 assert r=={'score':10,'active':0,'pickup':0},r;print('PASS immediate native nuclear pickup')
 r=q.evaluate('''()=>{ship.startLevel(1);ship.tuning.apply({enabled:true,respawnSeconds:0,shieldSeconds:7});const c=ship.cpu,G=ship.game,a=c.read(G+0x124);c.write(a+8,240);c.write(a+12,45);c.write(a+16,1);c.write(a+24,200);c.write(a+28,0);c.write(a+36,0);ship.frame();return {timer:c.read(G+0x1b0),protected:c.read(G+0x1a0),kind:ship.tuning.protectionKind};}''')
 assert r=={'timer':199,'protected':1,'kind':'shieldSeconds'},r
 r=q.evaluate('''()=>{ship.startLevel(1);ship.tuning.apply({...ship.tuning.config,respawnSeconds:2});const c=ship.cpu,G=ship.game;c.write(G+0x1b0,0);c.write(G+0x1a0,0);const a=c.read(G+0x128);c.write(a+8,240);c.write(a+12,30);c.write(a+16,1);ship.frame();let dead=ship.state();let frames=0;while(!ship.state().player&&frames++<160)ship.frame();return {dead,revived:ship.state(),frames,timer:c.read(G+0x1b0)};}''')
 assert not r['dead']['player'] and r['dead']['lives']==4 and r['revived']['player'] and r['timer']==57,r;print('PASS shield pickup, death and respawn protection')
 q.evaluate('ship.tuning.apply({...ship.tuning.config,bombLimit:100,volley:100,invincible:true,lives:999});for(let j=1;j<=20;j++){ship.startLevel(j);for(let i=0;i<300;i++){if(i%110===0)ship.keyDown(32);ship.frame();}if(ship.state().lives!==999)throw Error("continuous protection");}')
 print('PASS custom gameplay all 20 stages')
 # Same-page and fresh-page snapshot restoration.
 q.evaluate('ship.tuning.apply({...ship.tuning.config,invincible:true});ship.startLevel(13);ship.keyDown(32);ship.cpu.write(ship.game+0x190,4321)')
 snap=q.evaluate('Array.from(ShipSave.capture(ship))');expected=q.evaluate('ship.state()');q.evaluate('ship.startLevel(1)');q.evaluate('bytes=>ShipSave.restore(ship,ShipSave.decode(new Uint8Array(bytes)))',snap);assert q.evaluate('ship.state().bombs')==100
 fresh=boot(b);fresh.evaluate('bytes=>ShipSave.restore(ship,ShipSave.decode(new Uint8Array(bytes)))',snap);assert fresh.evaluate('ship.state().level')==13;assert fresh.evaluate('ship.state().score')==4321;assert fresh.evaluate('ship.state().bombs')==100
 fresh.evaluate('for(let i=0;i<160;i++)ship.frame()');assert fresh.evaluate('ship.state().bombs')==0;fresh.close();print('PASS same-page and fresh-page saves')
 # Native ranking insert and GBK name round trip.
 q.evaluate('ship.cpu.write(ship.game+0x190,12340);ship.end()');assert q.evaluate('ship.cpu.suspended');q.evaluate("ship.completeName('\u6d4b\u8bd5\u8005')");assert q.evaluate("ship.str(ship.cpu.read(ship.game+0x14c)+4)==='\u6d4b\u8bd5\u8005'")
 q.reload();q.wait_for_function('window.gameReady');q.evaluate('stopped=true');assert q.evaluate("ship.str(ship.cpu.read(ship.game+0x14c)+4)==='\u6d4b\u8bd5\u8005'");assert q.evaluate('ship.cpu.read(ship.cpu.read(ship.game+0x14c)+24)')==12340;print('PASS native name ranking and refresh')
 # All custom values apply and selected start level survives restarting and refresh.
 q.locator('#settings').click();q.locator('#customRules').check();q.locator('#bombLimit').fill('80');q.locator('#volley').fill('12');q.locator('#lives').fill('37');q.locator('#moveSpeed').fill('16');q.locator('#respawnSeconds').fill('5');q.locator('#shieldSeconds').fill('9');q.locator('#startLevel').select_option('17');q.locator('#speed').select_option('61');q.locator('#applySettings').click();q.locator('#start').click();q.evaluate('stopped=true');assert q.evaluate('ship.state().level')==17;assert q.evaluate('ship.state().lives')==37;assert q.evaluate('ship.state().capacity')==80
 q.reload();q.wait_for_function('window.gameReady');q.evaluate('stopped=true');assert q.evaluate('ship.state().level')==17;assert q.evaluate('ship.tuning.config.volley')==12;assert q.evaluate('ship.step')==61
 q.locator('#settings').click();q.locator('#startLevel').select_option('2');q.locator('[data-close="options"]').click();q.locator('#start').click();q.evaluate('stopped=true');assert q.evaluate('ship.state().level')==17
 q.locator('#settings').click();q.locator('#resetRules').click();q.locator('#applySettings').click();assert not q.evaluate('ship.tuning.config.enabled');assert q.evaluate('ship.state().capacity')==5;print('PASS custom settings, selected level, cancel and reset')
 for width in [320,390]:
  m=boot(b,width,740);m.locator('#settings').click();m.screenshot(path=str(root/f'docs/settings-{width}.png'));assert m.locator('[data-close="options"]').is_visible();assert m.evaluate('document.documentElement.scrollWidth<=innerWidth');m.locator('[data-close="options"]').click();m.locator('#help').click();m.screenshot(path=str(root/f'docs/help-{width}.png'));assert m.locator('#closeHelp').is_visible();m.close()
 print('PASS mobile dialogs 320/390')
 (root/'docs/gameplay-verification.json').write_text(json.dumps({'checks':'all passed','evidence':results},ensure_ascii=False,indent=2),encoding='utf8')
 q.close();b.close()
