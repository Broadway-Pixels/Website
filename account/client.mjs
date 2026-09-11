import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, sendEmailVerification, sendPasswordResetEmail, reload, signOut, EmailAuthProvider, reauthenticateWithCredential, verifyBeforeUpdateEmail, deleteUser } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, getDocFromServer, deleteDoc } from 'firebase/firestore';
import { firebaseConfig } from './config.mjs';
import { avatars, avatarId, avatarUrl } from './avatars.mjs';
const testing = typeof ACCOUNT_EMULATOR !== 'undefined' && ACCOUNT_EMULATOR && ['localhost','127.0.0.1'].includes(location.hostname);
const app = initializeApp(testing ? {...firebaseConfig, projectId:'demo-fishadise-accounts',apiKey:'demo-key'} : firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
if (testing) {
  connectAuthEmulator(auth,'http://127.0.0.1:19099',{disableWarnings:true});
  connectFirestoreEmulator(db,'127.0.0.1',18080);
}
const $ = id => document.getElementById(id);
let creating = false, busy = false, selectedAvatar = 'goldfish';
function selectAvatar(id){selectedAvatar=id; $('profile-avatar').src=new URL(avatarUrl(id)).pathname; for(const button of $('avatar-picker').querySelectorAll('button'))button.setAttribute('aria-pressed',String(button.dataset.avatar===id));}
for(const item of avatars){const button=document.createElement('button');button.type='button';button.dataset.avatar=item.id;button.setAttribute('aria-label',item.label);button.innerHTML='';const img=document.createElement('img');img.src=new URL(avatarUrl(item.id)).pathname;img.alt='';img.width=64;img.height=64;button.append(img,document.createTextNode(item.label));button.onclick=()=>selectAvatar(item.id);$('avatar-picker').append(button);}
const status = (message,error=false) => { $('status').textContent=message; $('status').classList.toggle('error',error); };
const run = async action => {
  if(busy)return;
  busy=true; document.querySelectorAll('button').forEach(button=>button.disabled=true);
  status('Connecting…');
  try{await action();}catch(error){
    const code=error?.code;
    status(code==='auth/too-many-requests'?'Too many attempts. Wait a little and try again.':code==='auth/requires-recent-login'?'For your security, sign out and sign in again before retrying.':code==='auth/network-request-failed'?'Could not connect. Check your connection and try again.':'Could not complete that request. Check your details and try again.',true);
  }finally{busy=false;document.querySelectorAll('button').forEach(button=>button.disabled=false);}
};
function mode(create){
  creating=create; $('name-row').hidden=!create; $('new-name').required=create;
  $('password-help').hidden=!create; $('create-terms').hidden=!create;
  $('password').minLength=create?8:1; $('password').autocomplete=create?'new-password':'current-password';
  $('login-submit').textContent=create?'Create account':'Sign in';
  $('reset-password').hidden=create;
  for(const [id,selected] of [['create-mode',create],['sign-in-mode',!create]]) { $(id).classList.toggle('selected',selected);$(id).setAttribute('aria-pressed',String(selected)); }
}
async function render(user){
  $('guest').hidden=!!user; $('member').hidden=!user;
  if(!user){$('player-name').value='';$('save-status').textContent='';return;}
  $('player-name').value=user.displayName||'';
  selectAvatar(avatarId(user.photoURL));
  $('account-email').textContent=user.email||'No email login';
  $('email-status').textContent=user.emailVerified?'Verified':'Not verified';
  $('verify-email').hidden=user.emailVerified;
  const ids=user.providerData.map(provider=>provider.providerId);
  $('providers').textContent=ids.map(id=>({'password':'Broadway Pixels email','apple.com':'Apple','gc.apple.com':'Game Center'}[id]||id)).join(', ');
  $('apple-delete-help').hidden=!ids.includes('apple.com');$('delete-form').hidden=ids.includes('apple.com');
  $('save-status').textContent='Checking your cloud save…';
  try{
    const save=await getDocFromServer(doc(db,'players',user.uid,'saves','main'));
    if(auth.currentUser?.uid!==user.uid)return;
    const date=save.data()?.savedAt?.toDate?.();
    $('save-status').textContent=save.exists() ? `Cloud save connected${date?'. Last saved '+date.toLocaleString():'.'}` : 'No cloud save yet. Sign in with this account in Fishadise, then turn on Cloud Save.';
  }catch{if(auth.currentUser?.uid===user.uid)$('save-status').textContent='Could not check your cloud save. Your account is signed in; refresh to try again.';}
}
onAuthStateChanged(auth,user=>{render(user);if(!busy)status(user?'You’re signed in.':'Sign in or create an account to get started.');},()=>status('Account connection failed. Refresh to try again.',true));
$('sign-in-mode').onclick=()=>mode(false);$('create-mode').onclick=()=>mode(true);
$('login-form').onsubmit=event=>{event.preventDefault();run(async()=>{
  const email=$('email').value.trim(),password=$('password').value,name=$('new-name').value.trim();
  if(creating&&(!name||password.length<8)){status('Enter a player name and a password of at least 8 characters.',true);return;}
  const result=creating?await createUserWithEmailAndPassword(auth,email,password):await signInWithEmailAndPassword(auth,email,password);
  $('password').value='';
  if(creating){await updateProfile(result.user,{displayName:name,photoURL:avatarUrl('goldfish')});await render(result.user);try{await sendEmailVerification(result.user);status('Account created. Check your email to verify your address.');}catch{status('Account created. Use Send verification email to try sending your verification link again.');}}
  else{await render(result.user);status('Signed in successfully.');}
});};
async function reset(email){if(!email||!$('email').checkValidity()&&!auth.currentUser){status('Enter your email address first.',true);return;}await sendPasswordResetEmail(auth,email);status('If this email has an account, a password reset link is on its way.');}
$('reset-password').onclick=()=>run(()=>reset($('email').value.trim()));
$('member-reset').onclick=()=>run(()=>reset(auth.currentUser.email));
$('sign-out').onclick=()=>run(async()=>{await signOut(auth);document.querySelectorAll('input').forEach(input=>{input.value='';if(input.type==='checkbox')input.checked=false;});status('Signed out.');});
$('profile-form').onsubmit=event=>{event.preventDefault();run(async()=>{const name=$('player-name').value.trim();if(!name||name.length>32){status('Use a player name of 1–32 characters.',true);return;}await updateProfile(auth.currentUser,{displayName:name,photoURL:avatarUrl(selectedAvatar)});status('Profile saved. Your fish icon will update in Fishadise when it reconnects.');});};
$('verify-email').onclick=()=>run(async()=>{await sendEmailVerification(auth.currentUser);status('Check your email for a verification link.');});
$('refresh-account').onclick=()=>run(async()=>{await reload(auth.currentUser);await render(auth.currentUser);status('Account refreshed.');});
async function reauthenticate(password){const user=auth.currentUser;if(!user?.email)throw new Error('No email login');await reauthenticateWithCredential(user,EmailAuthProvider.credential(user.email,password));return user;}
$('email-form').onsubmit=event=>{event.preventDefault();run(async()=>{const user=await reauthenticate($('email-password').value);await verifyBeforeUpdateEmail(user,$('updated-email').value.trim());$('email-password').value='';status('Check the new email address for a verification link. Your address changes after verification.');});};
$('delete-form').onsubmit=event=>{event.preventDefault();run(async()=>{if(!$('delete-confirm').checked)return;const user=await reauthenticate($('delete-password').value);await deleteDoc(doc(db,'players',user.uid,'saves','main'));await deleteUser(user);$('delete-password').value='';$('delete-confirm').checked=false;status('Account and cloud save deleted.');});};
