import test from 'node:test';import assert from 'node:assert/strict';import express from 'express';import retiredProfiles from '../src/routes/retiredProfiles.js';
test('removed profile collection and admin routes cannot accept data; withdrawal remains authenticated',async()=>{
 const app=express();app.use('/api/v1',retiredProfiles);const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const base='http://127.0.0.1:'+server.address().port;
 try{for(const method of ['PUT','PATCH','POST'])assert.equal((await fetch(base+'/api/v1/profile-sharing',{method})).status,410);assert.equal((await fetch(base+'/admin')).status,404);assert.equal((await fetch(base+'/api/v1/admin/profiles')).status,404);assert.equal((await fetch(base+'/api/v1/profile-sharing',{method:'DELETE'})).status,401);assert.equal((await(await fetch(base+'/api/v1/profile-sharing/status')).json()).data.reason,'removed');}finally{await new Promise(resolve=>server.close(resolve));}
});
