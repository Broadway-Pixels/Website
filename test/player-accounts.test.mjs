import test from 'node:test';
import {avatarUrl, avatarId} from '../account/avatars.mjs';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, reload, deleteUser, signOut, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, setDoc, getDocFromServer, deleteDoc, serverTimestamp, terminate } from 'firebase/firestore';

test('player identity persists across clients; cloud saves reject other players; reauthentication gates deletion', {skip:process.env.ACCOUNT_EMULATOR_TEST!=='1'}, async()=>{
 const apps=[];
 const client=()=>{const app=initializeApp({apiKey:'demo-key',projectId:'demo-fishadise-accounts'},crypto.randomUUID());apps.push(app);const auth=getAuth(app);connectAuthEmulator(auth,'http://127.0.0.1:19099',{disableWarnings:true});const db=getFirestore(app);connectFirestoreEmulator(db,'127.0.0.1',18080);return {auth,db};};
 const first=client(),website=client(),other=client();
 const email=`account-${crypto.randomUUID()}@example.test`,password='LocalTestOnly!123';
 try {
  const {user}=await createUserWithEmailAndPassword(first.auth,email,password);
  await updateProfile(user,{displayName:'Original Keeper'});
  await setDoc(doc(first.db,'players',user.uid,'saves','main'),{format:1,revision:'a'.repeat(32),payload:'test-cloud-payload',savedAt:serverTimestamp()});
  const signed=await signInWithEmailAndPassword(website.auth,email,password);
  assert.equal(signed.user.uid,user.uid);
  assert.equal((await getDocFromServer(doc(website.db,'players',user.uid,'saves','main'))).data().revision,'a'.repeat(32));
  await updateProfile(signed.user,{displayName:'Website Keeper',photoURL:avatarUrl('rainbow')});
  await reload(user);assert.equal(user.displayName,'Website Keeper');assert.equal(avatarId(user.photoURL),'rainbow');
  await updateProfile(user,{photoURL:avatarUrl('clownfish')});await reload(signed.user);assert.equal(avatarId(signed.user.photoURL),'clownfish');
  await signOut(website.auth);await signInWithEmailAndPassword(website.auth,email,password);assert.equal(avatarId(website.auth.currentUser.photoURL),'clownfish');
  await createUserWithEmailAndPassword(other.auth,`other-${crypto.randomUUID()}@example.test`,password);
  await assert.rejects(getDocFromServer(doc(other.db,'players',user.uid,'saves','main')),error=>error.code==='permission-denied');
  await assert.rejects(deleteDoc(doc(other.db,'players',user.uid,'saves','main')),error=>error.code==='permission-denied');
  await assert.rejects(reauthenticateWithCredential(signed.user,EmailAuthProvider.credential(email,'wrong-password')));
  assert.equal((await getDocFromServer(doc(website.db,'players',user.uid,'saves','main'))).exists(),true);
  await reauthenticateWithCredential(signed.user,EmailAuthProvider.credential(email,password));
  await deleteDoc(doc(website.db,'players',user.uid,'saves','main'));await deleteUser(signed.user);
  await signOut(first.auth);await assert.rejects(signInWithEmailAndPassword(first.auth,email,password));
  await deleteUser(other.auth.currentUser);
 }finally{await Promise.all([first,website,other].map(c=>terminate(c.db)));await Promise.all(apps.map(deleteApp));}
});
