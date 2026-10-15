import { chromium } from 'playwright';
const mobile = process.argv.includes('--mobile');
const address = mobile ? 'http://127.0.0.1:5174/?debug&touch' : 'http://127.0.0.1:5174/?debug';
const browser = await chromium.launch({headless:true,args:['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']});
const context = await browser.newContext(mobile ? {viewport:{width:412,height:915},deviceScaleFactor:2,isMobile:true,hasTouch:true} : {viewport:{width:1280,height:720}});
const page = await context.newPage();
const errors=[]; page.on('pageerror',e=>errors.push(e.message)); page.on('console',m=>{if(m.type()==='error'||m.type()==='warning')errors.push(m.text())});
const wait=ms=>page.waitForTimeout(ms);
const check=(ok,msg)=>{console.log(`${ok?'PASS':'FAIL'}: ${msg}`); if(!ok)process.exitCode=2};
await page.goto(address,{waitUntil:'load'}); await page.waitForFunction(()=>!!window.__lw,{timeout:30000});
await page.evaluate(async()=>{
 const {FreeCamera}=await import('/node_modules/.vite/deps/@babylonjs_core_Cameras_freeCamera.js');
 const proto=FreeCamera.prototype, original=proto.setTarget;
 window.__cameraTrace=[];
 proto.setTarget=function(target,...rest){original.call(this,target,...rest); if(this.name==='valley.camera') { const p=this.position; window.__cameraTrace.push({target:{x:target.x,y:target.y,z:target.z},pos:{x:p.x,y:p.y,z:p.z}}); if(window.__cameraTrace.length>1200)window.__cameraTrace.shift(); }};
});
await page.keyboard.press('Enter'); await wait(700);
await page.waitForFunction(()=>document.querySelector('.controls-hint .ch-label')?.textContent,{timeout:10000});
const label=()=>page.locator('.controls-hint .ch-label').last().textContent();
if(!mobile) check((await label())==='Go Inside',`outer desktop Q label = ${await label()}`);
if(mobile) check(await page.locator('.look-button').getAttribute('aria-label')==='Go inside',`outer touch button label = ${await page.locator('.look-button').getAttribute('aria-label')}`);
await page.evaluate(()=>window.__lw.debugBreath()); await wait(300); await page.evaluate(()=>{const p=window.__lw.bumpTrigger();window.__lw.teleport(p.x,p.z)}); await wait(800);
if(mobile) await page.locator('.look-button').dispatchEvent('pointerdown',{pointerId:31,pointerType:'touch',clientX:370,clientY:780,bubbles:true}); else await page.keyboard.press('KeyQ');
await page.waitForFunction(()=>window.__lw.world()==='inner'&&!window.__lw.transitioning(),null,{timeout:10000}); await wait(800);
if(!mobile) check((await label())==='Go Outside',`inner desktop Q label = ${await label()}`);
if(mobile) check(await page.locator('.look-button').getAttribute('aria-label')==='Go back to the village',`inner touch button label = ${await page.locator('.look-button').getAttribute('aria-label')}`);
await page.screenshot({path:`screenshots/q-camera-check/${mobile?'touch':'desktop'}/label-inner.png`});
await page.evaluate(()=>window.__lw.reveal()); await wait(200);
const tapButton=async()=>{ if(mobile){const b=await page.locator('.look-button').boundingBox(); await page.touchscreen.tap(b.x+b.width/2,b.y+b.height/2);} else await page.keyboard.press('KeyQ'); };
await tapButton(); await page.waitForFunction(()=>window.__lw.world()==='outer'&&!window.__lw.transitioning(),null,{timeout:10000}); await wait(250);
if(!mobile) check((await label())==='Go Inside',`outer return Q label = ${await label()}`);
if(mobile) check(await page.locator('.look-button').getAttribute('aria-label')==='Go inside',`outer return touch label = ${await page.locator('.look-button').getAttribute('aria-label')}`);
await tapButton(); await page.waitForFunction(()=>window.__lw.world()==='inner'&&!window.__lw.transitioning(),null,{timeout:10000}); await wait(1800);
const cameraNow=async()=>page.evaluate(()=>{const a=window.__cameraTrace;const c=a[a.length-1];const p=window.__lw.playerPos();return {targetY:c?.target.y,cam:c?.pos,player:p,offset:c?.target.y-p.y,traceCount:a.length}});
let snap=await cameraNow();
check(snap.traceCount>0,'numeric camera trace is available');
check(snap.offset>1.6,`entry focus raises target above player: ${snap.offset?.toFixed(2)} m`);
check(snap.cam && Math.hypot(snap.cam.x-snap.player.x,snap.cam.z-snap.player.z)>9,`entry focus opens camera: distance ${snap.cam?Math.hypot(snap.cam.x-snap.player.x,snap.cam.z-snap.player.z).toFixed(2):'missing'} m`);
await page.screenshot({path:`screenshots/q-camera-check/${mobile?'touch':'desktop'}/entry-focus.png`});
if(mobile){
 const cdp=await context.newCDPSession(page); await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:320,y:320,id:7}]}); await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:370,y:320,id:7}]}); await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
}else{
 const box=await page.locator('#renderCanvas').boundingBox(); await page.mouse.move(box.x+box.width/2,box.y+box.height/2); await page.mouse.down(); await page.mouse.move(box.x+box.width/2+170,box.y+box.height/2+20,{steps:6}); await page.mouse.up();
}
await wait(2200); snap=await cameraNow();
check(snap.offset<1.9,`${mobile?'touch':'mouse'} camera drag releases imp focus: target/player offset ${snap.offset?.toFixed(2)} m`);
await page.screenshot({path:`screenshots/q-camera-check/${mobile?'touch':'desktop'}/after-drag.png`});
await tapButton(); await page.waitForFunction(()=>window.__lw.world()==='outer'&&!window.__lw.transitioning(),null,{timeout:10000}); await wait(200); await tapButton(); await page.waitForFunction(()=>window.__lw.world()==='inner'&&!window.__lw.transitioning(),null,{timeout:10000}); await wait(1800);
snap=await cameraNow(); check(snap.offset>1.6,`repeat inner entry opens imp focus again: offset ${snap.offset?.toFixed(2)} m`);
await page.screenshot({path:`screenshots/q-camera-check/${mobile?'touch':'desktop'}/repeat-entry.png`});
const before=await page.evaluate(()=>window.__lw.playerPos());
if(mobile){const cdp=await context.newCDPSession(page); await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:90,y:330,id:8}]}); await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:90,y:265,id:8}]}); await wait(1300); await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});} else {await page.keyboard.down('KeyW');await wait(1300);await page.keyboard.up('KeyW');}
await wait(2200); const after=await cameraNow();
const dx=after.player.x-before.x,dz=after.player.z-before.z, cx=after.cam.x-after.player.x,cz=after.cam.z-after.player.z;
const dot=dx*cx+dz*cz;
check(Math.hypot(dx,dz)>.8,`${mobile?'touch joystick':'W key'} moved player ${Math.hypot(dx,dz).toFixed(2)} m`);
check(after.offset<1.9,`movement releases imp focus: target/player offset ${after.offset?.toFixed(2)} m`);
check(dot<0,`camera stays behind walking direction: camera/player dot movement = ${dot.toFixed(2)} m²`);
await page.screenshot({path:`screenshots/q-camera-check/${mobile?'touch':'desktop'}/after-move.png`});
console.log('camera evidence:',JSON.stringify({focus:snap,afterDrag:snap,afterMove:after,errors}));
console.log(`console errors/warnings/page errors: ${errors.length}`); for(const e of errors)console.log(e);
await browser.close();

