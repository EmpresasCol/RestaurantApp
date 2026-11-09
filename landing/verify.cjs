const {chromium}=require('C:/Users/abrahanbadelpalmett/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('assert/strict'),fs=require('fs'),path=require('path');
const {base}=require('./site.config.json');
const HOST='http://127.0.0.1:'+(process.env.PORT||4388);
const URL=HOST+base;
(async()=>{
  fs.mkdirSync(path.join(__dirname,'verification'),{recursive:true});
  const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>r.status()>=400&&!r.url().includes('no-existe')&&errors.push(r.status()+' '+r.url()));
  await page.goto(URL,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(1500);
  assert.equal(await page.locator('h1').count(),1);
  await page.screenshot({path:path.join(__dirname,'verification/desktop.png')});

  // Antes y después
  await page.getByRole('radio',{name:'Con Qpro'}).click();await page.waitForTimeout(700);
  assert.match(await page.locator('.ba-list').innerText(),/pantalla de cocina/);

  // Demo: pedir, cocinar, cobrar; el inventario baja
  const demo=page.locator('#demo');await demo.scrollIntoViewIfNeeded();
  const panBefore=Number(await demo.locator('.panel-stock li',{hasText:'Pan brioche'}).locator('b').innerText());
  await demo.getByRole('button',{name:/Enviar a cocina/}).click();await page.waitForTimeout(900);
  assert.match(await demo.locator('.kds-ticket').innerText(),/Mesa 4/);
  assert.equal(Number(await demo.locator('.panel-stock li',{hasText:'Pan brioche'}).locator('b').innerText()),panBefore-1);
  assert(await demo.getByRole('button',{name:'Esperando a cocina'}).isDisabled());
  await demo.getByRole('button',{name:'Empezar a preparar'}).click();await demo.getByRole('button',{name:'Marcar listo'}).click();
  await demo.getByRole('button',{name:/Cobrar \$/}).click();await page.waitForTimeout(600);
  assert.match(await demo.locator('.panel-cash').innerText(),/Factura/);
  await demo.getByRole('button',{name:'Hacer otro pedido'}).click();await demo.locator('.kds-empty').waitFor({timeout:3000});

  // Módulos fijos cambian con el scroll
  const track=await page.locator('.modules-track').evaluate(e=>({top:e.getBoundingClientRect().top+scrollY,height:e.offsetHeight}));
  await page.evaluate(({top,height})=>window.scrollTo({top:top+(height-innerHeight)*0.7,behavior:'instant'}),track);await page.waitForTimeout(900);
  assert.match(await page.locator('.mod-tabs li.active').innerText(),/Inventario|Domicilios/);
  await page.screenshot({path:path.join(__dirname,'verification/modulos.png')});

  // Preguntas
  await page.getByRole('button',{name:'¿Tengo que comprar equipos nuevos?'}).click();await page.waitForTimeout(500);
  assert(await page.locator('#faq-1').isVisible());

  // Formulario: validación sin abrir WhatsApp
  await page.locator('#contacto').scrollIntoViewIfNeeded();
  await page.getByRole('button',{name:'Enviar por WhatsApp'}).click();
  assert.equal(await page.locator('.field-error').count(),4);
  assert.equal(await page.locator('#f-nombre').getAttribute('aria-invalid'),'true');
  await page.fill('#f-nombre','Laura Martínez');await page.fill('#f-restaurante','Asadero La Ceiba');await page.fill('#f-telefono','123');
  await page.getByRole('button',{name:'Enviar por WhatsApp'}).click();
  assert.match(await page.locator('#e-telefono').innerText(),/10 dígitos/);
  const [popup]=await Promise.all([page.waitForEvent('popup'),(async()=>{await page.fill('#f-telefono','300 123 4567');await page.locator('.consent label').click();await page.getByRole('button',{name:'Enviar por WhatsApp'}).click();})()]);
  assert.match(decodeURIComponent(popup.url()),/Asadero.La.Ceiba/);await popup.close();
  assert(await page.getByRole('status').isVisible());

  // Responsive y menú móvil
  for(const width of [390,768]){
    await page.setViewportSize({width,height:844});await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.waitForTimeout(600);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Sin desbordamiento a ${width}px`);
    if(width===390){
      await page.getByRole('button',{name:'Abrir menú',exact:true}).click();assert(await page.locator('#mobile-nav').isVisible());
      await page.locator('#mobile-nav').getByRole('link',{name:'Preguntas'}).click();await page.waitForTimeout(500);assert.equal(await page.locator('#mobile-nav').count(),0);
      await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.waitForTimeout(800);
      await page.screenshot({path:path.join(__dirname,'verification/mobile.png')});
      // Carrusel de módulos: los puntos cambian el módulo visible
      await page.locator('.mod-track').scrollIntoViewIfNeeded();
      await page.getByRole('button',{name:'Ver Inventario'}).click();await page.waitForTimeout(900);
      assert.match(await page.locator('.mod-count').innerText(),/Inventario/);
    }
  }

  // Movimiento reducido: la franja y el sello no se animan
  await page.emulateMedia({reducedMotion:'reduce'});await page.reload({waitUntil:'networkidle'});
  assert.equal(await page.locator('.marquee-track').evaluate(e=>getComputedStyle(e).animationName),'none');

  // Páginas legales, 404 con estilos y archivos para buscadores
  for(const [file,title] of [['privacidad.html',/Política de tratamiento/],['terminos.html',/Términos de uso/]]){
    await page.goto(URL+file,{waitUntil:'networkidle'});assert.match(await page.locator('h1').innerText(),title);
    assert(!(await page.content()).includes('{{'),`Sin marcadores sin reemplazar en ${file}`);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
  await page.screenshot({path:path.join(__dirname,'verification/legal.png')});
  const miss=await page.goto(HOST+'/RestaurantApp/no-existe',{waitUntil:'networkidle'});assert.equal(miss.status(),404);
  assert.match(await page.locator('h1').innerText(),/no está en la carta/);
  assert.equal(await page.locator('.lost-ticket').evaluate(e=>getComputedStyle(e).borderRadius),'24px');
  await page.screenshot({path:path.join(__dirname,'verification/404.png')});
  await page.getByRole('link',{name:'Ir a la página de Qpro'}).click();await page.waitForLoadState('networkidle');assert.equal(page.url(),URL);
  for(const f of ['sitemap.xml','manifest.webmanifest','assets/og.png','assets/icon-512.png']) assert.equal((await page.request.get(URL+f)).status(),200,f);
  assert.match(await (await page.request.get(URL+'sitemap.xml')).text(),/https:\/\/empresascol\.github\.io\/RestaurantApp\/landing\/terminos\.html/);
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(__dirname,'verification/result.json'),JSON.stringify({passed:true,checks:['legales','404','sitemap y og','desktop','antes y después','demo pedido-cocina-caja-inventario','módulos con scroll','FAQ','validación y WhatsApp','390px y 768px sin desbordamiento','menú móvil','movimiento reducido','404'],errors},null,2));
  await browser.close();console.log('PASS: demo, antes/después, módulos, FAQ, formulario, responsive, menú móvil, movimiento reducido, legales, 404, sitemap.');
})().catch(e=>{console.error(e);process.exit(1)});
