import { initializeApp, getApps } from 'firebase/app';
import { getAuth, onAuthStateChanged, connectAuthEmulator } from 'firebase/auth';
import { firebaseConfig } from './config.mjs';
import { avatarId, avatarUrl } from './avatars.mjs';
const testing=typeof ACCOUNT_EMULATOR!=='undefined' && ACCOUNT_EMULATOR && ['localhost','127.0.0.1'].includes(location.hostname);
const app=getApps()[0] || initializeApp(testing ? {...firebaseConfig,projectId:'demo-fishadise-accounts',apiKey:'demo-key'} : firebaseConfig);
const auth=getAuth(app);
if(testing)connectAuthEmulator(auth,'http://127.0.0.1:19099',{disableWarnings:true});
onAuthStateChanged(auth,user=>{
 for(const link of document.querySelectorAll('a[data-account-link]')) {
  link.replaceChildren();
  if(user){const image=document.createElement('img');image.src=new URL(avatarUrl(avatarId(user.photoURL))).pathname;image.alt='';image.width=32;image.height=32;link.append(image);}
  link.append(document.createTextNode('Account'));
  link.setAttribute('aria-label',user?`Your account, ${user.displayName || 'Aquarium Keeper'}`:'Account');
 }
});
