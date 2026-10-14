'use strict';
const {chromium}=require(process.env.RAIN_PLAYWRIGHT||'playwright'),assert=require('node:assert/strict');
const {resolve}=require('node:path');
(async()=>{const browser=await chromium.launch({executablePath:process.env.RAIN_BROWSER_PATH,headless:true});try{
 const page=await browser.newPage(),hits=[];
 // Use Google's real tag but intercept collection so QA does not inflate traffic.
 await page.route('**/*',async r=>{
  const url=new URL(r.request().url());
  if(url.pathname.endsWith('/collect') && /(^|\.)google-analytics\.com$|(^|\.)analytics\.google\.com$/.test(url.hostname)) {
   hits.push({url,body:r.request().postData()||''});return r.fulfill({status:204});
  }
  if(url.hostname==='chendilin.com')return r.fulfill({contentType:'text/html',body:'<!doctype html><title>Critter Cascade</title><h1>Tag verification</h1>'});
  return r.continue();
 });
 await page.goto('https://chendilin.com/critter-cascade/?test=not-collected');
 await page.addScriptTag({path:resolve('critter-cascade/analytics.js')});
 for(let i=0;i<40&&!hits.some(x=>x.url.searchParams.get('en')==='page_view'||x.body.includes('en=page_view'));i++)await page.waitForTimeout(500);
 const hit=hits.find(x=>x.url.searchParams.get('en')==='page_view'||x.body.includes('en=page_view'));
 assert.ok(hit,'Google tag must construct a page_view collection request');assert.equal(hit.url.searchParams.get('tid'),'G-1WHG4EGXB3');assert.equal(hit.url.searchParams.get('dl'),'https://chendilin.com/critter-cascade/');
 const count=hits.length;await page.addScriptTag({path:resolve('critter-cascade/analytics.js')});await page.waitForTimeout(1000);assert.equal(hits.length,count);
 console.log('PASS: real Google tag emits page_view for Critter Cascade to G-1WHG4EGXB3 exactly once; collect intercepted, not sent to property.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
