import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {avatars,avatarId,avatarUrl} from '../account/avatars.mjs';
test('avatars accept only the shared cartoon catalogue, including safe defaults',async()=>{
 for(const item of avatars){assert.equal(avatarId(avatarUrl(item.id)),item.id);await access(new URL('../account/avatars/'+item.id+'.png',import.meta.url));}
 for(const url of [null,'https://example.com/tracker.png','https://broadwaypixels.com/account/avatars/goldfish.png?other=1','javascript:alert(1)'])assert.equal(avatarId(url),'goldfish');
});
test('main pages expose the account link and signed-in avatar navigation',async()=>{
 for(const name of ['index','music','content','projects','support','faq','privacy']){
  const html=await readFile(new URL('../'+name+'.html',import.meta.url),'utf8');assert.match(html,/href="\/account" data-account-link/);assert.match(html,/account-navigation.js/);
 }
});
