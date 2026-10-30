// Module initialization and every search run outside the browser UI thread.
import {SearchBackend} from './backend.js';
const backend=new SearchBackend();
let queue=Promise.resolve();
self.onmessage=({data})=>{
 queue=queue.then(async()=>{
  try{self.postMessage(await backend.dispatch(data));}
  catch(error){self.postMessage({type:'error',id:data.id,message:String(error?.message??error)});}
 });
};
