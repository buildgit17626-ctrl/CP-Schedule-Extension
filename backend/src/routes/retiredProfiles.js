import { Router } from 'express';
import mongoose from 'mongoose';
import { createHash } from 'node:crypto';
// Keep withdrawal available to older installations. New collection and admin access are gone.
const router = Router();
router.get('/profile-sharing/status', (_req,res)=>res.set('Cache-Control','no-store').json({success:true,data:{available:false,reason:'removed'}}));
router.delete('/profile-sharing', async(req,res)=>{
 const token=/^Bearer ([A-Za-z0-9_-]{43,128})$/.exec(req.get('Authorization')||'')?.[1];
 if(!token)return res.status(401).json({success:false,error:'A deletion credential is required.'});
 if(mongoose.connection.readyState!==1)return res.status(503).json({success:false,error:'Deletion will retry when storage is available.'});
 try{await mongoose.connection.collection('sharedprofiles').deleteOne({_id:createHash('sha256').update(token).digest('hex')});res.json({success:true});}catch{res.status(503).json({success:false,error:'Deletion will retry later.'});}
});
router.all('/profile-sharing',(_req,res)=>res.status(410).json({success:false,error:'Profile sharing has been removed.'}));
export default router;
